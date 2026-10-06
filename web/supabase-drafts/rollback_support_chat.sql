-- Откат support_chat.sql: сообщения игрока внутри обращения пропадут (сами обращения и ответы — нет).
drop function if exists public.add_support_message(bigint, text, text);
drop table if exists public.support_messages;
