import Foundation
import Capacitor
import GameKit

/// Online co-op over Game Center: invite a friend, then pass game messages
/// between the two phones. Apple relays the traffic, so there's no server.
///
/// JS name: `Coop` (see www/js/native.js and www/js/game/13b-coop.js).
/// - `invite()` shows Game Center's friend picker (invite-only: never strangers).
/// - Accepting an invite (notification / Messages) opens the same picker.
/// - When the match is ready, emits `matchStarted` { role: "host" | "guest" }:
///   whoever sent the invite hosts.
/// - `send({ data })` sends one JSON string reliably; arrivals emit `data`.
/// - The other player dropping out emits `peerLeft`.
@objc(CoopPlugin)
public class CoopPlugin: CAPPlugin, CAPBridgedPlugin, GKMatchmakerViewControllerDelegate, GKMatchDelegate, GKLocalPlayerListener {
    public let identifier = "CoopPlugin"
    public let jsName = "Coop"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "invite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var match: GKMatch?
    private var isHost = false
    private var listening = false

    override public func load() {
        // Invites can only be received once the player is signed in, and the
        // game signs in a moment after launch, so register when that happens.
        NotificationCenter.default.addObserver(self, selector: #selector(authChanged),
                                               name: .GKPlayerAuthenticationDidChangeNotificationName, object: nil)
        authChanged()
    }

    @objc private func authChanged() {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, !self.listening else { return }
            GKLocalPlayer.local.register(self)
            self.listening = true
        }
    }

    private func matchRequest() -> GKMatchRequest {
        let r = GKMatchRequest()
        r.minPlayers = 2
        r.maxPlayers = 2
        r.inviteMessage = "Come help me run my Burger Bar!"
        return r
    }

    private func present(_ vc: GKMatchmakerViewController) {
        vc.matchmakerDelegate = self
        if let pop = vc.popoverPresentationController, let view = bridge?.viewController?.view {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        }
        bridge?.viewController?.present(vc, animated: true)
    }

    @objc func invite(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false, "error": "Sign in to Game Center (Settings › Game Center) to play together."])
            return
        }
        DispatchQueue.main.async {
            guard let vc = GKMatchmakerViewController(matchRequest: self.matchRequest()) else {
                call.resolve(["ok": false, "error": "Couldn't open Game Center."]); return
            }
            vc.matchmakingMode = .inviteOnly
            self.isHost = true
            self.present(vc)
            call.resolve(["ok": true])
        }
    }

    // GKLocalPlayerListener: this player accepted a friend's invite.
    public func player(_ player: GKPlayer, didAccept invite: GKInvite) {
        DispatchQueue.main.async {
            guard let vc = GKMatchmakerViewController(invite: invite) else { return }
            self.isHost = false
            self.present(vc)
        }
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFind match: GKMatch) {
        viewController.dismiss(animated: true)
        self.match?.disconnect()
        self.match = match
        match.delegate = self
        notifyListeners("matchStarted", data: [
            "role": isHost ? "host" : "guest",
            "peerName": match.players.first?.displayName ?? ""
        ])
    }

    public func matchmakerViewControllerWasCancelled(_ viewController: GKMatchmakerViewController) {
        viewController.dismiss(animated: true)
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFailWithError error: Error) {
        viewController.dismiss(animated: true)
        notifyListeners("error", data: ["error": error.localizedDescription])
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let match = match, let text = call.getString("data"), let data = text.data(using: .utf8) else {
            call.resolve(["sent": false]); return
        }
        do {
            try match.sendData(toAllPlayers: data, with: .reliable)
            call.resolve(["sent": true])
        } catch {
            call.resolve(["sent": false, "error": error.localizedDescription])
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        match?.disconnect()
        match = nil
        call.resolve()
    }

    // GKMatchDelegate
    public func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        notifyListeners("data", data: ["data": text])
    }

    public func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        guard state == .disconnected, match === self.match else { return }
        self.match = nil
        notifyListeners("peerLeft", data: [:])
    }
}
