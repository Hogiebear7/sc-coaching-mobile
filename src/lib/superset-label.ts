// Supersets are stored as "ST1", "ST2" ... (a label shared by the exercises done back to back). A member should see them the way gyms write them:
// Superset A, with the exercises in it A1 and A2. The letters follow the order the supersets appear in the workout, so they stay A, B, C even if the
// stored labels are not 1, 2, 3.

/** The distinct superset labels in the order they first appear. */
export function distinctGroups(allGroups: (string | null | undefined)[]): string[] {
  const seen: string[] = [];
  for (const g of allGroups) {
    if (g && !seen.includes(g)) seen.push(g);
  }
  return seen;
}

function letterFor(index: number): string {
  // A to Z, then AA, AB ... (nobody will get there, but it must not break)
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** "A" for the first superset in the workout, "B" for the second ... Returns the stored label unchanged when it is not in the list. */
export function supersetLetter(group: string, allGroups: (string | null | undefined)[]): string {
  const i = distinctGroups(allGroups).indexOf(group);
  return i === -1 ? group : letterFor(i);
}

/** "A1", "A2" ... for the nth exercise (counting from 0) inside a superset. */
export function supersetMemberLabel(group: string, allGroups: (string | null | undefined)[], memberIndex: number): string {
  return `${supersetLetter(group, allGroups)}${memberIndex + 1}`;
}
