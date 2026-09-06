// Splits which EAS account/project a build belongs to by build profile, so
// day-to-day test builds (development/preview) spend the hogiebear777
// account's quota, and only the production profile (Play Store/App Store
// submissions) touches the real sandcmails-team project. Same app code and
// package name either way — a test build is never uploaded to a store, so
// a separate (fresh) test keystore under hogiebear777 is harmless.
//
// Driven by EAS_ACCOUNT_TARGET, set per build profile in eas.json's "env"
// block rather than relying on eas-cli's own implicit env vars — explicit
// and easy to verify with `eas config --profile <name>`. Defaults to the
// real sandcmails-team project whenever that var isn't exactly
// "hogiebear777" (local dev, `eas submit`, `eas update`, or anything else
// outside an actual `eas build` run) so nothing ambiguous ever silently
// lands on the test project by accident.
const ACCOUNTS = {
  hogiebear777: {
    owner: "hogiebear777",
    projectId: "b628245b-4347-4792-a061-b315e69c1a27",
  },
  "sandcmails-team": {
    owner: "sandcmails-team",
    projectId: "e91de324-82a4-437a-9344-1b8a89102f72",
  },
};

module.exports = ({ config }) => {
  const target = process.env.EAS_ACCOUNT_TARGET === "hogiebear777" ? ACCOUNTS.hogiebear777 : ACCOUNTS["sandcmails-team"];

  return {
    ...config,
    owner: target.owner,
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: target.projectId,
      },
    },
  };
};
