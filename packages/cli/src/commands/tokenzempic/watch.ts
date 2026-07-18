import { SfCommand } from '@salesforce/sf-plugins-core';
import { renderBanner } from '@tokenzempic/tui';

export default class Watch extends SfCommand<void> {
  public static readonly summary =
    'Live dashboard: sessions coming in, clusters forming, and how much of your traffic is deterministic now.';
  public static readonly examples = ['sf tokenzempic watch'];

  public async run(): Promise<void> {
    this.log(renderBanner());
    this.log('Not built yet. watch lands in v0.3.');
  }
}
