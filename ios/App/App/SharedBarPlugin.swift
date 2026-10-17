import Foundation
import UIKit
import Capacitor
import CloudKit
import GameKit

extension Notification.Name {
    static let sharedBarAccepted = Notification.Name("BurgerBarSharedBarAccepted")
}

/// The shared partnership bar, stored in iCloud (CloudKit) and shared between
/// two players. Free: it uses the players' own iCloud, no server.
///
/// One record ("bar") in its own zone in the OWNER's private database; the
/// whole zone is shared (CKShare) with the partner, who reads and writes it
/// through their shared database. The save itself is a JSON file (CKAsset).
///
/// One player at a time: `open()` takes a lock (lockOwner / lockAt) using
/// "save only if nobody changed it since I read it", so two phones can't both
/// win. The lock is renewed by every `save()` and is free again after
/// `lockSeconds` if a phone disappears without closing.
///
/// JS name: `SharedBar` (www/js/game/13c-sharedbar.js).
@objc(SharedBarPlugin)
public class SharedBarPlugin: CAPPlugin, CAPBridgedPlugin, UICloudSharingControllerDelegate {
    public let identifier = "SharedBarPlugin"
    public let jsName = "SharedBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "invite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise)
    ]

    static let containerID = "iCloud.com.clawengineering.burgerbar"
    static let zoneName = "SharedBarZone"
    static let recordName = "bar"
    static let recordType = "SharedBar"
    static let lockSeconds: TimeInterval = 15 * 60          // matches SHARED_LOCK_MINUTES in JS
    static let acceptedOwnerKey = "sharedBarAcceptedOwner"  // zone owner of a share we accepted

    private let container = CKContainer(identifier: SharedBarPlugin.containerID)
    private var openRecord: CKRecord?      // server copy while this phone holds the lock
    private var openDB: CKDatabase?
    private var shareTitle = "Our Burger Bar"

    override public func load() {
        NotificationCenter.default.addObserver(forName: .sharedBarAccepted, object: nil, queue: .main) { [weak self] note in
            self?.notifyListeners("accepted", data: ["name": (note.object as? String) ?? ""])
        }
    }

    // MARK: Share acceptance (called from SceneDelegate)

    static func accept(_ metadata: CKShare.Metadata) {
        let c = CKContainer(identifier: metadata.containerIdentifier)
        Task {
            do {
                _ = try await c.accept(metadata)
                UserDefaults.standard.set(metadata.share.recordID.zoneID.ownerName, forKey: acceptedOwnerKey)
                let title = metadata.share[CKShare.SystemFieldKey.title] as? String
                NotificationCenter.default.post(name: .sharedBarAccepted, object: title)
            } catch {
                NSLog("Burger Bar: accepting the shared bar failed: \(error)")
            }
        }
    }

    // MARK: Helpers

    private struct Location { let db: CKDatabase; let id: CKRecord.ID; let role: String }

    /// Where this player's shared bar lives: their own (owner), or one shared with them (partner).
    private func location() async -> Location? {
        let ownZone = CKRecordZone.ID(zoneName: Self.zoneName, ownerName: CKCurrentUserDefaultName)
        let ownID = CKRecord.ID(recordName: Self.recordName, zoneID: ownZone)
        if (try? await container.privateCloudDatabase.record(for: ownID)) != nil {
            return Location(db: container.privateCloudDatabase, id: ownID, role: "owner")
        }
        if let owner = UserDefaults.standard.string(forKey: Self.acceptedOwnerKey) {
            let zone = CKRecordZone.ID(zoneName: Self.zoneName, ownerName: owner)
            return Location(db: container.sharedCloudDatabase, id: CKRecord.ID(recordName: Self.recordName, zoneID: zone), role: "partner")
        }
        return nil
    }

    private func asset(_ json: String) throws -> CKAsset {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("sharedbar-\(UUID().uuidString).json")
        try json.data(using: .utf8)!.write(to: url)
        return CKAsset(fileURL: url)
    }

    private func readSave(_ rec: CKRecord) -> String? {
        guard let a = rec["save"] as? CKAsset, let url = a.fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Save one record only if nobody changed it since we read it.
    private func saveIfUnchanged(_ rec: CKRecord, in db: CKDatabase) async throws -> CKRecord {
        let (results, _) = try await db.modifyRecords(saving: [rec], deleting: [], savePolicy: .ifServerRecordUnchanged)
        guard let result = results[rec.recordID] else { throw CKError(.internalError) }
        return try result.get()
    }

    private func me() async throws -> String { try await container.userRecordID().recordName }

    private func myName() -> String {
        GKLocalPlayer.local.isAuthenticated ? GKLocalPlayer.local.displayName : "Your partner"
    }

    // MARK: Methods

    @objc func status(_ call: CAPPluginCall) {
        Task {
            do {
                guard try await self.container.accountStatus() == .available else {
                    call.resolve(["available": false, "error": "Sign in to iCloud in Settings"]); return
                }
                if let loc = await self.location(), let rec = try? await loc.db.record(for: loc.id) {
                    call.resolve(["available": true, "hasBar": true, "role": loc.role,
                                  "name": rec["name"] as? String ?? "Shared bar"])
                } else {
                    call.resolve(["available": true, "hasBar": false])
                }
            } catch {
                call.resolve(["available": false, "error": error.localizedDescription])
            }
        }
    }

    @objc func create(_ call: CAPPluginCall) {
        guard let save = call.getString("save") else { call.reject("save is required"); return }
        let name = call.getString("name") ?? "Our Burger Bar"
        Task {
            do {
                let db = self.container.privateCloudDatabase
                let zone = CKRecordZone(zoneName: Self.zoneName)
                _ = try await db.modifyRecordZones(saving: [zone], deleting: [])
                let rec = CKRecord(recordType: Self.recordType, recordID: CKRecord.ID(recordName: Self.recordName, zoneID: zone.zoneID))
                rec["name"] = name
                rec["save"] = try self.asset(save)
                rec["lockOwner"] = ""
                rec["lockName"] = ""
                rec["lockAt"] = Date(timeIntervalSince1970: 0)
                let share = CKShare(recordZoneID: zone.zoneID)
                share[CKShare.SystemFieldKey.title] = name
                share.publicPermission = .none          // only people you invite
                let (results, _) = try await db.modifyRecords(saving: [rec, share], deleting: [])
                for (_, r) in results { _ = try r.get() }
                self.shareTitle = name
                call.resolve(["ok": true])
            } catch {
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
        }
    }

    /// Apple's sharing sheet: send the invite link (Messages, Mail…) or manage the partner.
    @objc func invite(_ call: CAPPluginCall) {
        Task {
            do {
                let zoneID = CKRecordZone.ID(zoneName: Self.zoneName, ownerName: CKCurrentUserDefaultName)
                let shareID = CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zoneID)
                guard let share = try await self.container.privateCloudDatabase.record(for: shareID) as? CKShare else {
                    call.resolve(["ok": false, "error": "Only the bar's creator can invite."]); return
                }
                self.shareTitle = share[CKShare.SystemFieldKey.title] as? String ?? self.shareTitle
                await MainActor.run {
                    let vc = UICloudSharingController(share: share, container: self.container)
                    vc.delegate = self
                    vc.availablePermissions = [.allowPrivate, .allowReadWrite]
                    if let pop = vc.popoverPresentationController, let view = self.bridge?.viewController?.view {
                        pop.sourceView = view
                        pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                    }
                    self.bridge?.viewController?.present(vc, animated: true)
                }
                call.resolve(["ok": true])
            } catch {
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
        }
    }

    /// Take the lock and return the save, or say who's running it.
    @objc func open(_ call: CAPPluginCall) {
        Task {
            do {
                guard let loc = await self.location() else { call.resolve(["ok": false, "error": "No shared bar yet."]); return }
                let me = try await self.me()
                let rec = try await loc.db.record(for: loc.id)
                let owner = rec["lockOwner"] as? String ?? ""
                let at = rec["lockAt"] as? Date ?? .distantPast
                if !owner.isEmpty && owner != me && Date().timeIntervalSince(at) < Self.lockSeconds {
                    call.resolve(["ok": false, "locked": true, "lockedBy": rec["lockName"] as? String ?? "Your partner"]); return
                }
                rec["lockOwner"] = me
                rec["lockName"] = self.myName()
                rec["lockAt"] = Date()
                let saved = try await self.saveIfUnchanged(rec, in: loc.db)
                self.openRecord = saved
                self.openDB = loc.db
                call.resolve(["ok": true, "save": self.readSave(saved) ?? "", "name": saved["name"] as? String ?? "Shared bar"])
            } catch let e as CKError where e.code == .serverRecordChanged {
                call.resolve(["ok": false, "locked": true, "lockedBy": "Your partner"])
            } catch {
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
        }
    }

    @objc func save(_ call: CAPPluginCall) {
        write(call, release: false)
    }

    @objc func close(_ call: CAPPluginCall) {
        write(call, release: true)
    }

    /// Write the save (if given), renew or release our lock. If the server copy
    /// changed underneath us, keep going only if the lock is still ours.
    private func write(_ call: CAPPluginCall, release: Bool) {
        guard let rec = self.openRecord, let db = self.openDB else { call.resolve(["ok": false, "lostLock": !release]); return }
        let json = call.getString("save")
        Task {
            do {
                let me = try await self.me()
                func apply(_ r: CKRecord) throws {
                    if let json = json, !json.isEmpty { r["save"] = try self.asset(json) }
                    r["lockAt"] = release ? Date(timeIntervalSince1970: 0) : Date()
                    if release { r["lockOwner"] = ""; r["lockName"] = "" }
                }
                do {
                    try apply(rec)
                    self.openRecord = try await self.saveIfUnchanged(rec, in: db)
                } catch let e as CKError where e.code == .serverRecordChanged {
                    let server = try await db.record(for: rec.recordID)
                    guard (server["lockOwner"] as? String ?? "") == me else {
                        self.openRecord = nil; self.openDB = nil
                        call.resolve(["ok": false, "lostLock": true]); return
                    }
                    try apply(server)
                    self.openRecord = try await self.saveIfUnchanged(server, in: db)
                }
                if release { self.openRecord = nil; self.openDB = nil }
                call.resolve(["ok": true])
            } catch {
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
        }
    }

    // MARK: UICloudSharingControllerDelegate

    public func itemTitle(for csc: UICloudSharingController) -> String? { shareTitle }

    public func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {
        notifyListeners("error", data: ["error": error.localizedDescription])
    }
}
