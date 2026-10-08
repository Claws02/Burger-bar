import UIKit
import Capacitor

/// Capacitor's bridge view controller plus the app's own native plugins.
/// Main.storyboard uses this class instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }

    // The game is full-screen; keep the status bar and home indicator out of the way.
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
