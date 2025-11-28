
export const LANGUAGES = [
  "English", "Spanish", "Portuguese", "Italian", "French", "German",  
  "Dutch", "Russian", "Chinese (Simplified)", "Japanese", "Korean", "Arabic", 
  "Hindi", "Turkish", "Polish", "Swedish", "Norwegian", "Danish", "Finnish"
];

const DICTIONARY: Record<string, Record<string, string>> = {
  "Spanish": {
    "contacts": "contactos",
    "news": "noticias",
    "chat requests": "solicitudes de chat",
    "search": "buscar",
    "add contact": "añadir contacto",
    "online now": "en línea ahora",
    "my contacts": "mis contactos",
    "chat request pending… wait for the user to accept": "solicitud pendiente… espera a que el usuario acepte",
    "logout": "cerrar sesión",
    "all": "todos",
    "favorites": "favoritos",
    "recents": "recientes",
    "history": "historial",
    "search contacts...": "buscar contactos...",
    "no contacts found": "no se encontraron contactos",
    "online": "en línea"
  },
  "Portuguese": {
    "contacts": "contatos",
    "news": "notícias",
    "chat requests": "solicitações",
    "search": "pesquisar",
    "add contact": "adicionar",
    "online now": "online agora",
    "my contacts": "meus contatos",
    "chat request pending… wait for the user to accept": "solicitação pendente... aguarde o usuário aceitar",
    "logout": "sair",
    "all": "todos",
    "favorites": "favoritos",
    "recents": "recentes",
    "history": "histórico",
    "search contacts...": "pesquisar contatos...",
    "no contacts found": "nenhum contato encontrado",
    "online": "online"
  },
  "Italian": {
    "contacts": "contatti",
    "news": "notizie",
    "chat requests": "richieste chat",
    "search": "cerca",
    "add contact": "aggiungi",
    "online now": "online ora",
    "my contacts": "i miei contatti",
    "chat request pending… wait for the user to accept": "richiesta in sospeso... attendi che l'utente accetti",
    "logout": "esci",
    "all": "tutti",
    "favorites": "preferiti",
    "recents": "recenti",
    "history": "cronologia",
    "search contacts...": "cerca contatti...",
    "no contacts found": "nessun contatto trovato",
    "online": "online"
  },
  "French": {
    "contacts": "contacts",
    "news": "actualités",
    "chat requests": "demandes de chat",
    "search": "rechercher",
    "add contact": "ajouter contact",
    "online now": "en ligne maintenant",
    "my contacts": "mes contacts",
    "chat request pending… wait for the user to accept": "demande en attente… attendez l'acceptation",
    "logout": "déconnexion",
    "all": "tous",
    "favorites": "favoris",
    "recents": "récents",
    "history": "historique",
    "search contacts...": "rechercher des contacts...",
    "no contacts found": "aucun contact trouvé",
    "online": "en ligne"
  },
  "German": {
    "contacts": "kontakte",
    "news": "nachrichten",
    "chat requests": "chat-anfragen",
    "search": "suchen",
    "add contact": "kontakt hinzufügen",
    "online now": "jetzt online",
    "my contacts": "meine kontakte",
    "chat request pending… wait for the user to accept": "anfrage ausstehend… warten auf annahme",
    "logout": "abmelden",
    "all": "alle",
    "favorites": "favoriten",
    "recents": "kürzlich",
    "history": "verlauf",
    "search contacts...": "kontakte suchen...",
    "no contacts found": "keine kontakte gefunden",
    "online": "online"
  },
  "Japanese": {
    "contacts": "連絡先",
    "news": "ニュース",
    "chat requests": "チャットリクエスト",
    "search": "検索",
    "add contact": "連絡先を追加",
    "online now": "オンライン",
    "my contacts": "私の連絡先",
    "chat request pending… wait for the user to accept": "リクエスト保留中…承認をお待ちください",
    "logout": "ログアウト",
    "all": "すべて",
    "favorites": "お気に入り",
    "recents": "最近",
    "history": "履歴",
    "search contacts...": "連絡先を検索...",
    "no contacts found": "連絡先が見つかりません",
    "online": "オンライン"
  }
};

export function getTranslation(text: string, language: string | null): string {
  if (!language || language === "English") return text;
  
  const lowerKey = text.toLowerCase();
  const langDict = DICTIONARY[language];
  
  if (langDict && langDict[lowerKey]) {
      return langDict[lowerKey];
  }
  
  // Fallback: check if user passed a key that might be slightly different, 
  // but primarily rely on exact lower case matches.
  return text;
}

const WORD_DICTIONARIES: Record<string, Record<string, string>> = {
  "Spanish": {
    "hello": "hola",
    "hi": "hola",
    "thanks": "gracias",
    "thank": "gracias",
    "please": "por favor",
    "yes": "sí",
    "no": "no",
    "good": "bueno",
    "morning": "mañana",
    "night": "noche",
    "friend": "amigo",
    "message": "mensaje",
    "news": "noticias",
    "today": "hoy",
    "tomorrow": "mañana"
  },
  "Portuguese": {
    "hello": "olá",
    "hi": "olá",
    "thanks": "obrigado",
    "thank": "obrigado",
    "please": "por favor",
    "yes": "sim",
    "no": "não",
    "good": "bom",
    "morning": "manhã",
    "night": "noite",
    "friend": "amigo",
    "message": "mensagem",
    "news": "notícias",
    "today": "hoje",
    "tomorrow": "amanhã"
  },
  "French": {
    "hello": "bonjour",
    "hi": "salut",
    "thanks": "merci",
    "please": "s'il vous plaît",
    "yes": "oui",
    "no": "non",
    "good": "bon",
    "morning": "matin",
    "night": "nuit",
    "friend": "ami",
    "message": "message",
    "news": "actualités",
    "today": "aujourd'hui",
    "tomorrow": "demain"
  },
  "German": {
    "hello": "hallo",
    "hi": "hallo",
    "thanks": "danke",
    "please": "bitte",
    "yes": "ja",
    "no": "nein",
    "good": "gut",
    "morning": "morgen",
    "night": "nacht",
    "friend": "freund",
    "message": "nachricht",
    "news": "nachrichten",
    "today": "heute",
    "tomorrow": "morgen"
  }
};

export function translateText(text: string, language: string | null): string {
  if (!language || language === "English") return text;
  const dict = WORD_DICTIONARIES[language];
  if (!dict) return text;
  const tokens = text.split(/(\s+)/);
  const out = tokens.map(tok => {
    if (tok.trim() === "") return tok;
    const core = tok.replace(/[^\p{L}\p{N}']/gu, "");
    const lower = core.toLowerCase();
    const mapped = dict[lower];
    if (!mapped) return tok;
    const rebuilt = tok.replace(core, mapped);
    return rebuilt;
  });
  return out.join("");
}
