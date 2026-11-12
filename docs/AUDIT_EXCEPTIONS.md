# npm Audit Exceptions

This document tracks explicitly accepted npm audit findings that cannot be resolved without breaking changes or have no available patches.

## Acceptance Criteria

Per the security policy, production dependency findings are handled as follows:

- **Critical & High**: Must be resolved or have explicit documented acceptance
- **Moderate**: Resolved where feasible without breaking changes
- **Low**: Accepted with documented rationale

## Current Accepted Exceptions

### deepmerge Prototype Poisoning (LOW severity)

**Finding**: GHSA-gcqx-w48m-w2h4  
**Severity**: Low  
**Package**: `deepmerge` >= 4.2.0  
**Affected Production Dependencies**:
- `@expo/config` (via `expo-constants`)
- `@expo/cli` (transitive)
- `@expo/metro-config` (transitive)
- `@expo/prebuild-config` (transitive)
- `expo-asset` (transitive)
- `expo-notifications` (transitive)

**Vulnerability**: Prototype pollution in `mergeObject()` function

**Status**: ACCEPTED  
**Reason**:
1. **No patch available**: All released versions of deepmerge (4.2.0 through 4.3.1) are affected
2. **Transitive dependency**: deepmerge is not directly used by application code; it's a transitive dependency of the Expo SDK
3. **Expo ecosystem lock-in**: Upgrading expo to a hypothetical future version that uses a patched deepmerge would require breaking changes across the entire mobile stack
4. **Severity**: LOW - requires attacker to control merge inputs, which are not user-facing in our usage
5. **Mitigation**: The affected Expo packages use deepmerge only for build-time configuration merging, not runtime user data
6. **Production impact**: Zero - expo packages are primarily used in development/build tooling; minimal runtime footprint

**Accepted By**: Mark Jordan  
**Date**: November 11, 2026  
**Review Date**: Next major Expo SDK upgrade or when deepmerge maintainers release a patched version

**Monitoring**: Track https://github.com/advisories/GHSA-gcqx-w48m-w2h4 for updates

---

## Audit Exception Process

When adding a new exception:

1. Document the CVE/GHSA identifier
2. List all affected packages
3. Provide clear rationale for acceptance
4. Set a review date
5. Add monitoring links

When removing an exception:

1. Update this document
2. Verify npm audit --omit=dev no longer reports the finding
3. Document the resolution in git commit message
