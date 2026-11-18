// Textos da seção "Sobre mim". Edite à vontade: o layout se ajusta.

import { ABOUT_CONFIG } from "./config";

export const ABOUT = {
  index: "01",
  label: "Sobre mim",

  photo: ABOUT_CONFIG.photo, // qual foto: em src/components/about/config.ts
  photoAlt: "Foto de Guilherme Silva Dutra",

  // Frase de abertura (não precisa repetir o nome: ele já está no hero)
  title: "Transformo modelos de IA em produtos que as pessoas usam.",

  paragraphs: [
    "Sou engenheiro de IA em Brasília e estudo Engenharia de Software na Universidade de Brasília (UnB). Hoje sou residente em Inteligência Artificial no Eldorado, onde construo agentes com RAG e text-to-SQL e faço fine-tuning de modelos de linguagem, sempre medindo cada versão com um framework de avaliação próprio, porque modelo bom é modelo que se prova em números.",
    "Antes da IA, passei pelo produto de ponta a ponta: no estágio em desenvolvimento fullstack na GM Soluções, evoluí sistemas da ANTT usados em todo o Brasil com React, TypeScript e FastAPI, cuidando do deploy em Kubernetes. Além disso, durante um projeto desenvolvi em Flutter um aplicativo de crédito para uma instituição financeira, da engenharia de requisitos à acessibilidade.",
    "No meu TCC, pesquiso IA explicável na classificação de lesões de pele, comparando CNNs e Vision Transformers e investigando em quais regiões da imagem cada modelo se apoia para decidir.",
  ],
};
