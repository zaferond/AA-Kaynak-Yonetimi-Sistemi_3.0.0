/** Visibility only: never remove completed projects from allocation/capacity data. */
export function visibleProjectsByCompletion<T extends { completed?: boolean }>(
  projects: T[],
  showCompleted: boolean,
): T[] {
  return showCompleted
    ? projects
    : projects.filter((project) => !project.completed);
}
