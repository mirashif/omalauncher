import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "io.github.omalauncher"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    // The external qs.Ui module exposes this Item API at runtime.
    // qmllint disable unresolved-type
    anchors.fill: parent
    // qmllint enable unresolved-type
    bar: root.bar
    text: ""
    slotSize: Style.bar.iconSlot
    tooltipText: "Omalauncher"
    onPressed: function(button) {
      if (!root.bar) return
      if (button === Qt.RightButton) {
        root.bar.run("omarchy-shell shell summon io.github.omalauncher '{\"source\":\"bar\",\"route\":\"settings\"}'")
      } else {
        root.bar.run("omarchy-shell shell toggle io.github.omalauncher '{\"source\":\"bar\"}'")
      }
    }
  }
}
