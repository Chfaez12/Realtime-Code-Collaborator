export interface ChatMessage {
  id: string;
  clientId: number;
  userId?: string; 
  name: string;
  color: string;
  text: string;
  timestamp: number;
}