export interface ICreateSpecialtyPayload {
  name: string;
  description?: string;
}

export interface IUpdateSpecialtyPayload {
  name?: string;
  description?: string;
}
