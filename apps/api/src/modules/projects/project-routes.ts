import { apiContract } from '../../contract';

const { listScopeChanges, previewScopeChange, proposeScopeChange, decideScopeChange, ...rest } =
  apiContract.projects;

/** `apiContract.projects` split in two so each controller handles one concern. */
export const scopeChangeRoutes = {
  listScopeChanges,
  previewScopeChange,
  proposeScopeChange,
  decideScopeChange,
};
export const projectRoutes = rest;
