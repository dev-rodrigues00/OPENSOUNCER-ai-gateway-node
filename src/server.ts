import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import pino from 'pino';

const fastify = Fastify({
  logger: pino({ level: 'info' }),
});

fastify.register(cors, { origin: '*' });

const ChatCompletionSchema = z.object({
  model: z.string().default('gpt-4o-mini'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  temperature: z.number().optional().default(0.7),
  stream: z.boolean().optional().default(false),
});

// Healthcheck
fastify.get('/api/health', async () => ({
  status: 'healthy',
  service: 'enterprise-ai-gateway',
  cache: 'connected',
  timestamp: new Date().toISOString(),
}));

// OpenAI-Compatible Chat Completions Endpoint with Semantic Cache
fastify.post('/v1/chat/completions', async (request, reply) => {
  const body = ChatCompletionSchema.parse(request.body);
  const userMessage = body.messages.filter((m) => m.role === 'user').pop()?.content || '';

  // 1. Simulação de L1/L2 Semantic Cache Hit
  if (userMessage.toLowerCase().includes('o que é') || userMessage.toLowerCase().includes('como')) {
    return reply.send({
      id: `chatcmpl_cached_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[RESPOSTA VIA CACHE SEMÂNTICO VETORIAL (< 15ms)]: Resposta otimizada em cache para: "${userMessage}". Custo com API: $0.00.`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 30,
        total_tokens: 45,
        cache_discount: '100%',
      },
    });
  }

  // 2. Fallback / Live Inference Mock
  return reply.send({
    id: `chatcmpl_live_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `[RESPOSTA VIA PROVEDOR LLM COM FALLBACK]: Processado com sucesso pelo AI Gateway. Resposta para: "${userMessage}".`,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 25,
      completion_tokens: 40,
      total_tokens: 65,
    },
  });
});

fastify.listen({ port: 3002, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err;
  console.log(`🛡️ AI Gateway & Semantic Cache rodando em ${address}`);
});
