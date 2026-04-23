import { getClient } from "@/shared/api/acpConnection";

export interface SkillProjectLink {
  id: string;
  name: string;
  workingDir: string;
}

export type SkillSourceKind = "global" | "project";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  instructions: string;
  path: string;
  directoryPath: string;
  sourceKind: SkillSourceKind;
  sourceLabel: string;
  projectLinks: SkillProjectLink[];
  editable: boolean;
}

interface SourceEntry {
  type: "skill";
  name: string;
  description: string;
  content: string;
  directory: string;
  global: boolean;
}

const PROJECT_SKILLS_MARKER = "/.goose/skills/";

function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function deriveProjectRoot(directory: string): string | null {
  const idx = directory.lastIndexOf(PROJECT_SKILLS_MARKER);
  return idx >= 0 ? directory.slice(0, idx) : null;
}

function toSkillInfo(source: SourceEntry): SkillInfo {
  const sourceKind: SkillSourceKind = source.global ? "global" : "project";
  const projectRoot = source.global
    ? null
    : deriveProjectRoot(source.directory);
  const projectName = projectRoot ? basename(projectRoot) : "";

  const projectLinks: SkillProjectLink[] = projectRoot
    ? [
        {
          id: projectRoot,
          name: projectName || projectRoot,
          workingDir: projectRoot,
        },
      ]
    : [];

  return {
    id: `${sourceKind}:${source.directory}`,
    name: source.name,
    description: source.description,
    instructions: source.content,
    path: `${source.directory}/SKILL.md`,
    directoryPath: source.directory,
    sourceKind,
    sourceLabel:
      sourceKind === "global" ? "Personal" : projectName || "Project",
    projectLinks,
    editable: true,
  };
}

export async function createSkill(
  name: string,
  description: string,
  instructions: string,
): Promise<void> {
  const client = await getClient();
  await client.extMethod("_goose/sources/create", {
    type: "skill",
    name,
    description,
    content: instructions,
    global: true,
  });
}

export async function listSkills(projectDir?: string): Promise<SkillInfo[]> {
  const client = await getClient();
  const params: Record<string, unknown> = { type: "skill" };
  if (projectDir && projectDir.trim().length > 0) {
    params.projectDir = projectDir;
  }
  const raw = await client.extMethod("_goose/sources/list", params);
  const sources = (raw.sources ?? []) as SourceEntry[];
  return sources.map(toSkillInfo);
}

export async function deleteSkill(
  name: string,
  options: { global?: boolean; projectDir?: string } = {},
): Promise<void> {
  const client = await getClient();
  const isGlobal = options.global ?? true;
  const params: Record<string, unknown> = {
    type: "skill",
    name,
    global: isGlobal,
  };
  if (!isGlobal && options.projectDir) {
    params.projectDir = options.projectDir;
  }
  await client.extMethod("_goose/sources/delete", params);
}

export async function updateSkill(
  name: string,
  description: string,
  instructions: string,
  options: { global?: boolean; projectDir?: string } = {},
): Promise<SkillInfo> {
  const client = await getClient();
  const isGlobal = options.global ?? true;
  const params: Record<string, unknown> = {
    type: "skill",
    name,
    description,
    content: instructions,
    global: isGlobal,
  };
  if (!isGlobal && options.projectDir) {
    params.projectDir = options.projectDir;
  }
  const raw = await client.extMethod("_goose/sources/update", params);
  return toSkillInfo(raw.source as SourceEntry);
}

export async function exportSkill(
  name: string,
  options: { global?: boolean; projectDir?: string } = {},
): Promise<{ json: string; filename: string }> {
  const client = await getClient();
  const isGlobal = options.global ?? true;
  const params: Record<string, unknown> = {
    type: "skill",
    name,
    global: isGlobal,
  };
  if (!isGlobal && options.projectDir) {
    params.projectDir = options.projectDir;
  }
  const raw = await client.extMethod("_goose/sources/export", params);
  return { json: raw.json as string, filename: raw.filename as string };
}

export async function importSkills(
  fileBytes: number[],
  fileName: string,
): Promise<SkillInfo[]> {
  if (!fileName.endsWith(".skill.json") && !fileName.endsWith(".json")) {
    throw new Error("File must have a .skill.json or .json extension");
  }
  const data = new TextDecoder().decode(new Uint8Array(fileBytes));
  const client = await getClient();
  const raw = await client.extMethod("_goose/sources/import", {
    data,
    global: true,
  });
  const sources = (raw.sources ?? []) as SourceEntry[];
  return sources.map(toSkillInfo);
}
