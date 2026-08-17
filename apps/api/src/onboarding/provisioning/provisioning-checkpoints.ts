export interface ProvisioningCheckpoint {
  checkpoint: number;
  task: string;
  progress: number;
}


export const CHECKPOINT_TASKS: readonly ProvisioningCheckpoint[] = [
  { checkpoint: 1, task: 'Creating organization...', progress: 5 },
  { checkpoint: 2, task: 'Assigning owner...', progress: 15 },
  { checkpoint: 3, task: 'Creating owner role...', progress: 30 },
  { checkpoint: 4, task: 'Configuring departments...', progress: 45 },
  { checkpoint: 5, task: 'Setting up subscription...', progress: 65 },
  { checkpoint: 6, task: 'Applying industry settings...', progress: 85 },
  { checkpoint: 7, task: 'Industry lifecycle...', progress: 95 },
];