import QtQuick
import qs.Commons
import qs.Ui as Ui

FocusScope {
  id: root

  Accessible.role: Accessible.Dialog
  Accessible.name: "Welcome to Omalauncher"
  Accessible.description: stage === "verify"
    ? "Verify the selected launcher shortcut"
    : "Choose a global launcher shortcut"

  property string stage: "pending"
  property string hotkey: "SUPER + SPACE"
  property string statusText: "Checking whether this shortcut is available…"
  property bool statusIsError: false
  property bool recording: false
  property bool captureActive: false
  property bool busy: false
  property bool canSkip: false
  property bool existingLauncherBinding: false
  property bool replacementPending: false
  property bool replacesMenu: false
  property bool replacementBlocked: false

  signal recordRequested()
  signal applyRequested()
  signal tryRequested()
  signal continueRequested()
  signal skipRequested()
  signal keyPressed(var event)

  Keys.priority: Keys.BeforeItem
  Keys.onPressed: function(event) {
    if (root.recording) root.keyPressed(event)
  }

  onRecordingChanged: if (recording) root.forceActiveFocus()
  Component.onCompleted: primaryButton.forceActiveFocus()

  Rectangle {
    anchors.fill: parent
    radius: Style.cornerRadius
    color: Color.menu.background
    border.width: Math.max(1, Style.space(1))
    border.color: Color.menu.border
  }

  MouseArea {
    anchors.fill: parent
    onClicked: root.forceActiveFocus()
  }

  Column {
    width: Math.min(parent.width - Style.space(64), Style.space(540))
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(16)

    Text {
      width: parent.width
      text: root.stage === "verify" ? "2  /  2" : "1  /  2"
      color: Util.alpha(Color.menu.text, 0.72)
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.caption
      font.weight: Font.DemiBold
      horizontalAlignment: Text.AlignHCenter
    }

    Text {
      width: parent.width
      text: ""
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.space(32)
      horizontalAlignment: Text.AlignHCenter
      Accessible.ignored: true
    }

    Text {
      width: parent.width
      text: root.stage === "verify"
        ? "Your launcher shortcut is ready"
        : "Open Omalauncher from anywhere"
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.title
      font.weight: Font.DemiBold
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }

    Text {
      width: parent.width
      text: root.stage === "verify"
        ? "Close Omalauncher, press the shortcut, and we’ll confirm everything works."
        : "Choose one memorable global shortcut. You can change it later in Settings."
      color: Util.alpha(Color.menu.text, 0.82)
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.body
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }

    Item { width: 1; height: Style.space(2) }

    Ui.Button {
      id: hotkeyButton
      width: parent.width
      height: Style.space(72)
      text: root.recording
        ? (root.captureActive ? "Press your shortcut…" : "Preparing shortcut capture…")
        : (root.hotkey || "Choose a shortcut")
      fontSize: Style.font.heading
      fontFamily: Style.font.menuFamily
      bordered: true
      focusable: root.stage !== "verify"
      active: root.recording
      enabled: root.stage !== "verify" && !root.busy
      tooltipText: root.stage === "verify" ? "Shortcut selected" : "Record a different shortcut"
      Accessible.name: root.recording ? "Recording a launcher shortcut" : "Launcher shortcut " + root.hotkey
      Accessible.description: root.stage === "verify"
        ? "The shortcut is ready to verify"
        : "Press to record a different global shortcut"
      onClicked: root.recordRequested()
    }

    Text {
      width: parent.width
      text: root.statusText
      visible: text.length > 0
      color: root.statusIsError ? Color.urgent : Util.alpha(Color.menu.text, 0.82)
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.bodySmall
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }

    Item { width: 1; height: Style.space(2) }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      spacing: Style.space(10)

      Ui.Button {
        visible: root.stage === "pending" && root.canSkip
        text: "Set up later"
        focusable: visible
        enabled: !root.busy
        onClicked: root.skipRequested()
      }

      Ui.Button {
        visible: root.stage === "verify"
        text: "Continue anyway"
        focusable: visible
        enabled: !root.busy
        onClicked: root.continueRequested()
      }

      Ui.Button {
        id: primaryButton
        text: root.stage === "verify"
          ? "Close and try it"
          : (root.replacementPending
              ? "Replace existing shortcut"
              : (root.existingLauncherBinding
                  ? "Keep this shortcut"
                  : (root.replacesMenu ? "Replace Omarchy Menu" : "Use this shortcut")))
        iconText: root.stage === "verify" ? "󰌌" : ""
        selected: true
        focusable: true
        enabled: !root.busy && !root.recording && !root.replacementBlocked
          && root.hotkey.length > 0
        onClicked: {
          if (root.stage === "verify") root.tryRequested()
          else root.applyRequested()
        }
      }
    }
  }
}
