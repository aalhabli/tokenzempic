import { SfCommand } from '@salesforce/sf-plugins-core';

export default class Compile extends SfCommand<void> {
  public static readonly summary =
    'Turn the biggest cluster into Apex with parity tests, and open a PR for review.';
  public static readonly examples = ['sf tokenzempic compile'];

  public async run(): Promise<void> {
    this.log('Not built yet. compile lands in v0.2.');
  }
}
