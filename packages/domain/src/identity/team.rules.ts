/** What a studio decides about one team: its name, a short note and who leads it. */
export interface TeamDefinition {
  readonly name: string;
  readonly description: string | null;
  /** The person who leads the team; any active member of the studio, or nobody. */
  readonly leadUserId: string | null;
}

export const TEAM_LIMITS = {
  nameMinLength: 2,
  nameMaxLength: 60,
  descriptionMaxLength: 300,
} as const;

export interface TeamProblem {
  readonly field: keyof TeamDefinition;
  readonly message: string;
}

const collapseSpaces = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Tidies the name's spacing and turns an empty description into none. */
export function normaliseTeamDefinition(definition: TeamDefinition): TeamDefinition {
  const description = definition.description?.trim() ?? '';
  return {
    ...definition,
    name: collapseSpaces(definition.name),
    description: description === '' ? null : description,
  };
}

/** Names are unique per studio regardless of case or spacing ("Design" = " design "). */
export function teamNameKey(name: string): string {
  return collapseSpaces(name).toLocaleLowerCase();
}

/** Every problem with a team, worded for the person filling in the form. */
export function validateTeamDefinition(definition: TeamDefinition): TeamProblem[] {
  const limits = TEAM_LIMITS;
  const problems: TeamProblem[] = [];
  const name = definition.name.trim();
  if (name.length < limits.nameMinLength || name.length > limits.nameMaxLength) {
    problems.push({
      field: 'name',
      message: `Use ${limits.nameMinLength} to ${limits.nameMaxLength} characters.`,
    });
  }
  if ((definition.description ?? '').length > limits.descriptionMaxLength) {
    problems.push({
      field: 'description',
      message: `Keep the description under ${limits.descriptionMaxLength} characters.`,
    });
  }
  return problems;
}

/**
 * Why a team cannot be archived yet, or null when it can. Archiving is blocked
 * while active people are on the team: an archived team cannot be chosen, so
 * leaving people on it would strand them in a team nobody can pick or filter by.
 * Deactivated people keep the team on their record as history.
 */
export function teamArchiveBlocker(activeMemberCount: number): string | null {
  if (activeMemberCount <= 0) return null;
  const people = activeMemberCount === 1 ? '1 person' : `${activeMemberCount} people`;
  return `Move the ${people} on this team to another team (or to no team) first.`;
}
