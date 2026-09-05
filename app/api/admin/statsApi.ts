import apiClient from '@/lib/http/api-client';

export interface SystemStats {
  agent_status: 'online' | 'degraded' | 'offline';
  latency_ms: number;
  vector_chunks: number;
  active_documents: number;
  active_sessions: number;
  total_conversations: number;
  updated_at: string;
}

const statsApi = {
  getSystemStats(): Promise<{ success: boolean; data: SystemStats }> {
    return apiClient.get('/api/admin/stats');
  },
};

export default statsApi;
