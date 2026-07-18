import { SfCommand } from '@salesforce/sf-plugins-core';

export default class Report extends SfCommand<void> {
  public static readonly summary =
    'Show what your agent does all day and what each slice of it costs.';
  public static readonly examples = ['sf tokenzempic report'];

  public async run(): Promise<void> {
    this.log('Not built yet. report lands in v0.1.');
  }
}
