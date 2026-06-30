import type { CaptureContext, CaptureFilter, CaptureFilterResult } from "./filters/types.js";

export class CapturePipeline {
  constructor(private readonly filters: CaptureFilter[] = []) {}

  addFilter(filter: CaptureFilter): this {
    this.filters.push(filter);
    return this;
  }

  setFilters(filters: CaptureFilter[]): this {
    this.filters.length = 0;
    this.filters.push(...filters);
    return this;
  }

  getFilters(): readonly CaptureFilter[] {
    return this.filters;
  }

  async evaluate(context: CaptureContext): Promise<CaptureFilterResult> {
    for (const filter of this.filters) {
      const allowed = await filter.shouldCapture(context);
      if (!allowed) {
        return { allowed: false, rejectedBy: filter.name };
      }
    }
    return { allowed: true };
  }
}