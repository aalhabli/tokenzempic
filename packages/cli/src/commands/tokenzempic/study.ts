import { SfCommand } from '@salesforce/sf-plugins-core';

export default class Study extends SfCommand<void> {
  public static readonly summary =
    'Pull agent session traces and cluster them by what the agent actually did. Read-only.';
  public static readonly examples = ['sf tokenzempic study'];

  public async run(): Promise<void> {
    this.log('Not built yet. study lands in v0.1.');
  }
}
