// Projetos do carrossel. Edite à vontade: textos, imagens, tags e links.
// Tudo entre [colchetes] é PROVISÓRIO; as imagens também
// (geradas por tools/build_project_placeholders.py).
// tags: chaves de TECHS em src/components/hero/techs.ts (os mesmos ícones da espiral).

export type Project = {
  title: string;
  summary: string; // descrição breve, aparece no cartão
  description: string[]; // descrição completa (parágrafos), aparece ao abrir
  tags: string[];
  image: string;
  imageAlt: string;
  // (opcional) que parte da imagem aparece no cartão, que é vertical (3:4).
  // Igual ao object-position do CSS, ex.: "left center", "30% center".
  imagePosition?: string;
  // onde está hospedado / código. Sem o link, o botão não aparece.
  links: { live?: string; code?: string };
  // (opcional) selo ao lado do número, ex.: "Em construção"
  status?: string;
};

export const PROJECTS_SECTION = {
  index: "02",
  label: "Projetos",
  title: "Projetos que desenvolvi",
  hint: "Arraste para girar · clique para abrir",
};

export const PROJECTS: Project[] = [
  {
    title: "Checa AI",
    summary:
      "Assistente no Telegram que estima a propensão de uma notícia ser desinformação, cruzando checagens de 9 agências e fontes da web, e mostra o caminho até a resposta.",
    description: [
      "Boa parte da desinformação no Brasil circula em aplicativos de mensagem, encaminhada por quem não tem tempo nem ferramentas para conferir. O Checa AI recebe o texto, o título ou o link de uma notícia pelo Telegram e devolve a propensão de aquele conteúdo ser desinformação (baixa, média, alta ou indeterminada), as fontes que embasam a estimativa e o passo a passo da análise. Ele nunca diz que algo \"é falso\": mostra os indícios e devolve a decisão para quem lê.",
      "Por trás, um pipeline de seis etapas: um LLM extrai as afirmações verificáveis, que são buscadas em uma base de cerca de 22 mil checagens de 9 agências (índice BM25 atualizado todo dia pelo GitHub Actions) e, se preciso, na web. As páginas são lidas por inteiro e um LLM juiz diz se cada fonte confirma, contesta ou só relata a afirmação, com o trecho citado conferido na página. A propensão final vem de uma regra fixa e documentada, não de um LLM.",
      "Minha parte principal foi o modelo próprio da equipe: o fine-tuning do BERTimbau sobre 91 mil textos rotulados, com deduplicação, pesos por grupo e calibração de Platt. No teste (13,6 mil textos), chegou a 82,5% de acurácia, macro-F1 de 0,785, ROC-AUC de 0,896 e erro de calibração de 0,024, e virou um sinal de estilo exibido junto da resposta. O projeto foi feito em equipe de seis pessoas no Desafio First Challenge e tem mais de 1.200 testes automatizados.",
    ],
    tags: ["python", "fastapi", "pytorch", "huggingface", "telegram"],
    image: "/projects/checa-ai.webp",
    imageAlt: "Capa do Checa AI: o nome do projeto e a legenda de propensão de desinformação (baixa, média, alta e indeterminada)",
    imagePosition: "6% center",
    links: {
      live: "https://checa-ai.onrender.com/", // botão "Ver projeto" / "Acessar projeto"
      code: "https://github.com/thiago-cg/Checa-AI", // botão "Código" / "Ver código"
    },
  },
  {
    title: "Trase RAG",
    status: "Em construção",
    summary:
      "Agente de IA que responde perguntas sobre as cadeias da soja e da carne bovina e sobre a legislação ambiental, citando a origem de cada número e de cada artigo de lei.",
    description: [
      "Um chatbot sobre as cadeias produtivas da soja e da carne bovina brasileiras, a partir dos dados do Trase (fluxos de exportação, exposição ao desmatamento, emissões e indicadores por município, estado e bioma), e sobre sete leis ambientais federais, como o Código Florestal e a Lei de Crimes Ambientais. Cada número e cada artigo citado na resposta aponta para a consulta ou o trecho de onde saiu.",
      "Cada tipo de fonte tem a sua recuperação. As tabelas não viram embeddings: rankings, somas e séries temporais exigem cálculo exato, então os números saem de SQL no DuckDB, com consultas prontas ou um SELECT gerado pelo LLM em uma conexão isolada. As leis são limpas dos trechos revogados, divididas por artigo e indexadas no PostgreSQL com pgvector, com busca híbrida (vetorial + full-text, fundida por RRF). Um agente com ferramentas decide, a cada pergunta, o que consultar e pode combinar as fontes numa mesma resposta.",
      "Cada versão é medida em um framework de avaliação próprio, com LLM-as-judge, MRR, ROUGE-L e BLEU. Até aqui, o agente chegou a 98% de acerto em valores numéricos, 84% de fidelidade às fontes, 93% de context recall e Hit@5 de 75%. Os próximos passos são um reranker sobre a busca híbrida e a indexação da metodologia do Trase.",
    ],
    tags: ["python", "duckdb", "postgresql", "docker", "anthropic"],
    image: "/projects/trase-rag.webp",
    imageAlt: "Mapa do Brasil com os municípios coloridos pela exposição ao desmatamento",
    links: {
      // ainda sem deploy: o botão "Ver projeto" não aparece
      code: "https://github.com/arthur-suares/Rag-trace-dataset", // botão "Código" / "Ver código"
    },
  },
  {
    title: "Dutra Interiores",
    summary:
      "Site da marcenaria da minha família, de móveis planejados, com vitrine animada pela rolagem, galeria de fotos e vídeos dos trabalhos e pedido de orçamento direto pelo WhatsApp.",
    description: [
      "Site institucional da marcenaria da minha família, que faz móveis planejados e sob medida. A ideia era que o próprio site transmitisse o cuidado com acabamento que a marcenaria vende: em vez de um catálogo comum, os trabalhos aparecem em ambientes reais, com vídeo e fotos em boa resolução.",
      "A página inicial é uma vitrine guiada pela rolagem, em três cenas que trocam imagem, vídeo e texto conforme a pessoa desce, com partículas de serragem animadas no fundo e um ritmo de rolagem próprio para o celular. A página de trabalhos tem uma galeria filtrável entre fotos e vídeos, com visualização em tela cheia, e a de contato leva o pedido de orçamento direto para o WhatsApp.",
      "Feito com React, TypeScript e TanStack Start, estilizado com Tailwind CSS e publicado na Cloudflare Workers.",
    ],
    tags: ["react", "typescript", "tailwind", "cloudflare"],
    image: "/projects/dutra-interiores.webp",
    imageAlt: "Cozinha planejada em madeira com bancada de granito preto e iluminação embutida",
    links: {
      live: "https://dutra-interiores.dutrainteriores.workers.dev/", // botão "Ver projeto" / "Acessar projeto"
      code: "https://github.com/GuiDutra21/dutra_interiores", // botão "Código" / "Ver código"
    },
  },
  {
    title: "IA explicável em lesões de pele",
    status: "Em construção",
    summary:
      "TCC que compara CNNs e Vision Transformers na classificação de lesões de pele e usa IA explicável para mostrar em quais regiões da imagem cada modelo se apoia para decidir.",
    description: [
      "Modelos de visão computacional já ajudam a classificar lesões de pele, mas funcionam como caixa-preta, e em um contexto médico isso pesa: um dermatologista só confia em um diagnóstico se entende de onde ele veio. Neste TCC, feito em dupla na Universidade de Brasília, investigamos como técnicas de IA explicável revelam os padrões de decisão desses modelos.",
      "Comparamos 6 arquiteturas (VGG, MobileNet, GoogLeNet, Xception, ConvNeXt e ViT) na classificação de 7 tipos de lesão da base HAM10000, com fine-tuning em PyTorch, data augmentation, amostragem balanceada e ajuste de hiperparâmetros. O melhor resultado até aqui é o do ConvNeXt-Base, com F1-macro de 0,81 e acurácia de 80,5%. A generalização é testada em uma base externa, a BCN20000.",
      "Depois, aplicamos Grad-CAM++, LeGrad e attention rollout para gerar mapas de calor das decisões e medimos a fidelidade dessas explicações com AOPC, para relacionar o desempenho de cada modelo às regiões da imagem que ele realmente usa, como na lesão em si ou na pele saudável em volta.",
    ],
    tags: ["python", "pytorch", "scikitlearn"],
    image: "/projects/tcc-xai.webp",
    imagePosition: "95% center", // no cartão aparece o mapa de calor (lado direito)
    imageAlt: "Lesão vascular da base HAM10000 classificada corretamente, ao lado do mapa de calor do LeGrad concentrado sobre a lesão",
    links: {}, // trabalho acadêmico, ainda sem link público
  },
];
