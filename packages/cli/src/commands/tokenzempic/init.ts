import { SfCommand } from '@salesforce/sf-plugins-core';

export default class Init extends SfCommand<void> {
  public static readonly summary =
    'Point tokenzempic at an agent, a GitHub repo, and an LLM key. Writes tokenzempic.config.json.';
  public static readonly examples = ['sf tokenzempic init'];

  public async run(): Promise<void> {
    this.log('Not built yet. init lands in v0.1.');
  }
}
