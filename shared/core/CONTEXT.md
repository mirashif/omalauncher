# OmaLauncher Core

OmaLauncher Core owns deterministic records and decisions shared by launcher
surfaces. It does not fetch remote data or change the installed system.

## Plugins

**Marketplace listing**:
Third-party discovery metadata for one plugin at a catalog generation time.
It is not an installed package or a trust decision.
_Avoid_: Available plugin, package

**Installed plugin snapshot**:
Host-observed state for a plugin currently discoverable by Omarchy, including
whether it is enabled and first-party.
_Avoid_: Marketplace listing

**Registry verification**:
The community marketplace's reported review state for a specific upstream
snapshot. It is not a security audit, endorsement, or guarantee about mutable
upstream code.
_Avoid_: Trusted, safe, certified

**Lifecycle intent**:
A validated, side-effect-free instruction to view, install, enable, disable,
update, or remove a plugin. A host adapter decides how to execute it.
_Avoid_: Command string, installation
