import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../services/api';

export function useConversations(params = {}) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => aiApi.listConversations(params),
  });
}

export function useConversation(id) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => aiApi.getConversation(id),
    enabled: !!id,
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => aiApi.updateConversation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
