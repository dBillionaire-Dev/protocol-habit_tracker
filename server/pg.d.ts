declare module "pg" {
  export class Pool {
    constructor(config?: any);
    connect(): Promise<any>;
    query(queryText: string, values?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}
