import { colors } from "../lib/constants.js";
import {
  readCostCenters,
  writeCostCenters,
  type CostCenter,
} from "../lib/config-store.js";
import * as logger from "../lib/logger.js";

export interface TagOptions {
  costCenter?: string;
}

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function listMappings(centers: CostCenter[]): void {
  if (centers.length === 0) {
    console.log();
    console.log(colors.dim("  No cost centers configured."));
    console.log(
      "  " +
        colors.wolf("Hint: Create cost centers in the Kova dashboard at ") +
        colors.brand("kova.dev/dashboard"),
    );
    console.log();
    return;
  }

  console.log();
  console.log(colors.bold("  Cost Center Mappings"));
  console.log(colors.dim("  " + "-".repeat(48)));

  for (const cc of centers) {
    const nameStr = cc.name.padEnd(20);
    const projectList =
      cc.projects.length > 0 ? cc.projects.join(", ") : colors.dim("(none)");
    console.log("  " + colors.brand(nameStr) + colors.wolf(projectList));
  }

  console.log();
}

export async function tagCommand(
  project: string | undefined,
  options: TagOptions,
): Promise<void> {
  const centers = readCostCenters();

  // List mode: no project arg given
  if (!project) {
    listMappings(centers);
    return;
  }

  const costCenterName = options.costCenter;

  if (!costCenterName) {
    logger.error(
      "Specify a cost center with --cost-center <name>. Example: kova tag my-project --cost-center Engineering",
    );
    return;
  }

  // Find or create the cost center
  const existing = centers.find(
    (cc) => cc.name.toLowerCase() === costCenterName.toLowerCase(),
  );

  if (existing) {
    if (existing.projects.includes(project)) {
      logger.info(
        `Project "${project}" is already mapped to cost center "${existing.name}".`,
      );
      return;
    }
    existing.projects.push(project);
    logger.success(
      `Mapped project "${project}" to cost center "${existing.name}".`,
    );
  } else {
    const newCenter: CostCenter = {
      id: generateId(costCenterName),
      name: costCenterName,
      projects: [project],
    };
    centers.push(newCenter);
    logger.success(
      `Created cost center "${costCenterName}" and mapped project "${project}" to it.`,
    );
  }

  writeCostCenters(centers);

  // Show hint about dashboard
  logger.info(`View cost center breakdown at kova.dev/dashboard`);
}
