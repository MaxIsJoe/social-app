import {BskyAgent} from '@atproto-labs/api'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {useSession} from '#/state/session'
import {useDmServiceUrlStorage} from '#/screens/Messages/Temp/useDmServiceUrlStorage'
import * as TempDmChatDefs from '#/temp/dm/defs'
import * as TempDmChatGetChat from '#/temp/dm/getChat'
import * as TempDmChatGetChatForMembers from '#/temp/dm/getChatForMembers'
import * as TempDmChatGetChatLog from '#/temp/dm/getChatLog'
import * as TempDmChatGetChatMessages from '#/temp/dm/getChatMessages'

export const useHeaders = () => {
  const {currentAccount} = useSession()
  return {
    get Authorization() {
      return currentAccount!.did
    },
  }
}

type Chat = {
  chatId: string
  messages: TempDmChatGetChatMessages.OutputSchema['messages']
  lastCursor?: string
  lastRev?: string
}

export function useChat(chatId: string) {
  const queryClient = useQueryClient()
  const headers = useHeaders()
  const {serviceUrl} = useDmServiceUrlStorage()

  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      const currentChat = queryClient.getQueryData(['chat', chatId])

      if (currentChat) {
        return currentChat as Chat
      }

      const messagesResponse = await fetch(
        `${serviceUrl}/xrpc/temp.dm.getChatMessages?chatId=${chatId}`,
        {
          headers,
        },
      )

      if (!messagesResponse.ok) throw new Error('Failed to fetch messages')

      const messagesJson =
        (await messagesResponse.json()) as TempDmChatGetChatMessages.OutputSchema

      const chatResponse = await fetch(
        `${serviceUrl}/xrpc/temp.dm.getChat?chatId=${chatId}`,
        {
          headers,
        },
      )

      if (!chatResponse.ok) throw new Error('Failed to fetch chat')

      const chatJson =
        (await chatResponse.json()) as TempDmChatGetChat.OutputSchema

      queryClient.setQueryData(['chatQuery', chatId], chatJson.chat)

      const newChat = {
        chatId,
        messages: messagesJson.messages,
        lastCursor: messagesJson.cursor,
        lastRev: chatJson.chat.rev,
      } satisfies Chat

      queryClient.setQueryData(['chat', chatId], newChat)

      return newChat
    },
  })
}

interface SendMessageMutationVariables {
  message: string
  tempId: string
}

export function createTempId() {
  return Math.random().toString(36).substring(7).toString()
}

export function useSendMessageMutation(chatId: string) {
  const queryClient = useQueryClient()
  const headers = useHeaders()
  const {serviceUrl} = useDmServiceUrlStorage()

  return useMutation<
    TempDmChatDefs.Message,
    Error,
    SendMessageMutationVariables,
    unknown
  >({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: async ({message, tempId}) => {
      const response = await fetch(
        `${serviceUrl}/xrpc/temp.dm.sendMessage?chatId=${chatId}`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message: {
              text: message,
            },
          }),
        },
      )

      if (!response.ok) throw new Error('Failed to send message')

      return response.json()
    },
    onMutate: async variables => {
      queryClient.setQueryData(['chat', chatId], (prev: Chat) => {
        return {
          ...prev,
          messages: [
            {
              $type: 'temp.dm.defs#messageView',
              id: variables.tempId,
              text: variables.message,
              sender: {did: headers.Authorization}, // TODO a real DID get
              sentAt: new Date().toISOString(),
            },
            ...prev.messages,
          ],
        }
      })
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['chat', chatId], (prev: Chat) => {
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === variables.tempId ? {...m, id: result.id} : m,
          ),
        }
      })
    },
    onError: (_, variables) => {
      console.log(_)
      queryClient.setQueryData(['chat', chatId], (prev: Chat) => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== variables.tempId),
      }))
    },
  })
}

export function useChatLogQuery() {
  const queryClient = useQueryClient()
  const headers = useHeaders()
  const {serviceUrl} = useDmServiceUrlStorage()

  return useQuery({
    queryKey: ['chatLog'],
    queryFn: async () => {
      const prevLog = queryClient.getQueryData([
        'chatLog',
      ]) as TempDmChatGetChatLog.OutputSchema

      try {
        const response = await fetch(
          `${serviceUrl}/xrpc/temp.dm.getChatLog?cursor=${
            prevLog?.cursor ?? ''
          }`,
          {
            headers,
          },
        )

        if (!response.ok) throw new Error('Failed to fetch chat log')

        const json =
          (await response.json()) as TempDmChatGetChatLog.OutputSchema

        if (json.logs.length > 0) {
          queryClient.invalidateQueries({queryKey: ['chats']})
        }

        for (const log of json.logs) {
          if (TempDmChatDefs.isLogCreateMessage(log)) {
            queryClient.setQueryData(['chat', log.chatId], (prev: Chat) => {
              // TODO hack filter out duplicates
              if (prev?.messages.find(m => m.id === log.message.id)) return

              return {
                ...prev,
                messages: [log.message, ...prev.messages],
              }
            })
          }
        }

        return json
      } catch (e) {
        console.log(e)
      }
    },
    refetchInterval: 5000,
  })
}

export function useGetChatFromMembers({
  onSuccess,
  onError,
}: {
  onSuccess?: (data: TempDmChatGetChatForMembers.OutputSchema) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()
  const headers = useHeaders()
  const {serviceUrl} = useDmServiceUrlStorage()

  return useMutation({
    mutationFn: async (members: string[]) => {
      const response = await fetch(
        `${serviceUrl}/xrpc/temp.dm.getChatForMembers?members=${members.join(
          ',',
        )}`,
        {headers},
      )

      if (!response.ok) throw new Error('Failed to fetch chat')

      return (await response.json()) as TempDmChatGetChatForMembers.OutputSchema
    },
    onSuccess: data => {
      queryClient.setQueryData(['chat', data.chat.id], {
        chatId: data.chat.id,
        messages: [],
        lastRev: data.chat.rev,
      })
      onSuccess?.(data)
    },
    onError,
  })
}

export function useListConvos() {
  const headers = useHeaders()
  const {serviceUrl} = useDmServiceUrlStorage()

  return useInfiniteQuery({
    queryKey: ['chats'],
    queryFn: async ({pageParam}) => {
      const agent = new BskyAgent({service: serviceUrl})
      const {data} = await agent.api.chat.bsky.convo.listConvos(
        {cursor: pageParam},
        {headers},
      )

      return data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.cursor,
  })
}
