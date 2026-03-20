import { readConfig } from "../lib/config-store.js";
import { colors } from "../lib/constants.js";
import * as logger from "../lib/logger.js";

const ENTERPRISE_MESSAGE =
  "Enterprise feature. Upgrade at kova.dev/pricing to access policy management.";

const ADMIN_MESSAGE =
  "Requires admin API access. Contact your Kova workspace administrator.";

/** Known policy keys checked during local enforce. */
const KNOWN_POLICIES: Array<{
  key: string;
  description: string;
  check: () => string | null;
}> = [
  {
    key: "budget.monthly_usd",
    description: "Monthly budget must be set",
    check: () => {
      const config = readConfig();
      return config.budget.monthly_usd === null
        ? "No monthly budget configured. Run: kova budget --monthly <amount>"
        : null;
    },
  },
  {
    key: "sso.enabled",
    description: "SSO must be enabled for enterprise environments",
    check: () => {
      const config = readConfig();
      return config.sso?.enabled
        ? null
        : "SSO not enabled. Run: kova sso configure --issuer <url>";
    },
  },
];

export async function policyListCommand(): Promise<void> {
  console.log();
  console.log(colors.bold("  Kova Policy Management"));
  console.log(colors.dim("  " + "-".repeat(44)));
  console.log();
  console.log("  " + colors.wolf(ENTERPRISE_MESSAGE));
  console.log();
  console.log(
    "  " +
      colors.dim("Available in: ") +
      colors.brand("Team") +
      colors.dim(" and ") +
      colors.brand("Enterprise") +
      colors.dim(" plans."),
  );
  console.log();
  logger.info("Upgrade at kova.dev/pricing");
}

export async function policySetCommand(
  _key: string | undefined,
  _value: string | undefined,
): Promise<void> {
  console.log();
  console.log("  " + colors.wolf(ADMIN_MESSAGE));
  console.log();
  logger.info(
    "Contact your Kova workspace administrator to manage org-level policies.",
  );
}

export async function policyEnforceCommand(): Promise<void> {
  const config = readConfig();
  const violations: string[] = [];

  console.log();
  console.log(colors.bold("  Policy Enforcement Check"));
  console.log(colors.dim("  " + "-".repeat(44)));
  console.log();

  for (const policy of KNOWN_POLICIES) {
    const violation = policy.check();
    if (violation) {
      violations.push(violation);
      console.log(
        "  " + colors.error("[FAIL]") + " " + colors.wolf(policy.description),
      );
      console.log("         " + colors.dim(violation));
    } else {
      console.log(
        "  " + colors.success("[PASS]") + " " + colors.wolf(policy.description),
      );
    }
  }

  console.log();

  if (violations.length > 0) {
    logger.warn(`${violations.length} policy violation(s) found.`);
    logger.info("Fix the issues above or contact your Kova admin.");
  } else {
    logger.info("All local policy checks passed.");
  }

  // Suppress unused variable warning — config is used by the policy checks
  void config;
}
