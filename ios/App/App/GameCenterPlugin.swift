import Foundation
import Capacitor
import GameKit

/// Minimal Game Center bridge for Burger Bar: sign-in, leaderboard scores,
/// the native leaderboard UI, and achievement progress.
///
/// JS name: `GameCenter` (see www/js/native.js). All methods resolve rather
/// than reject when the player simply isn't signed in, so the game never
/// has to treat "no Game Center" as an error.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievement", returnType: CAPPluginReturnPromise)
    ]

    private var pendingSignIn: [CAPPluginCall] = []
    private var handlerInstalled = false

    private func playerInfo() -> [String: Any] {
        let p = GKLocalPlayer.local
        return ["authenticated": p.isAuthenticated, "playerName": p.isAuthenticated ? p.displayName : ""]
    }

    /// Installs GameKit's authenticate handler (once). GameKit calls it again
    /// whenever the auth state changes, so every waiting call is resolved.
    @objc func signIn(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated { call.resolve(playerInfo()); return }
        pendingSignIn.append(call)
        if handlerInstalled { return }
        handlerInstalled = true
        DispatchQueue.main.async {
            GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
                guard let self = self else { return }
                if let vc = viewController {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                var info = self.playerInfo()
                if let error = error { info["error"] = error.localizedDescription }
                let waiting = self.pendingSignIn
                self.pendingSignIn.removeAll()
                waiting.forEach { $0.resolve(info) }
                self.notifyListeners("authChanged", data: info)
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let board = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required"); return
        }
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["submitted": false]); return }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [board]) { error in
            if let error = error { call.resolve(["submitted": false, "error": error.localizedDescription]) }
            else { call.resolve(["submitted": true]) }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc: GKGameCenterViewController
            if let board = call.getString("leaderboardId") {
                vc = GKGameCenterViewController(leaderboardID: board, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    @objc func reportAchievement(_ call: CAPPluginCall) {
        guard let id = call.getString("achievementId") else { call.reject("achievementId is required"); return }
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["reported": false]); return }
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = call.getDouble("percent") ?? 100
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            if let error = error { call.resolve(["reported": false, "error": error.localizedDescription]) }
            else { call.resolve(["reported": true]) }
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
