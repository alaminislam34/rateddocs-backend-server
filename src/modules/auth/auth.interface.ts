export interface EmailCallbackUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface EmailCallbackData {
  user: EmailCallbackUser;
  url: string;
  token: string;
}
