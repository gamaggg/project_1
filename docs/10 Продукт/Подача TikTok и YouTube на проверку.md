---
tags:
  - продукт
  - продвижение
aliases:
  - "Проверка TikTok и YouTube"
updated: 2026-11-27
---
# Подача TikTok и YouTube на проверку (черновик от 27.11.2026)

Нужна, чтобы публикация через программу шла открыто, а не скрытой ([[Продвижение в соцсетях]], раздел «Ограничения»). Бесплатно, занимает недели. До одобрения бот присылает ролик и подпись, владелец выкладывает вручную.

## Что уже есть
- Сайт `https://catchrange.com`, политика конфиденциальности `https://catchrange.com/privacy` (русский, английский, грузинский; действует с 23.11.2026).
- Владелец домена подтверждается сам: сайт на Vercel, DNS у владельца.
- Публикует **только владелец** и только после «Принять» в боте: массовых и автоматических постов от чужих имён нет.

## Чего не хватает до подачи
- **Адрес условий использования:** страница `https://catchrange.com/terms` (и `/terms/en`, `/terms/ka`) сделана 27.11.2026 из текста условий в приложении; заработает после выкладки.
- **Короткого демо-видео** (1–2 минуты, экран): вход в бота, пост на согласование, «Принять», выход ролика на площадку. Снимает владелец.
- **Входа владельца** в Google (аккаунт с каналом RANGE, `catchrange@gmail.com`) и в TikTok for Developers: пароли вводит владелец.

## YouTube (Google Cloud, YouTube Data API v3)
1. Проект «RANGE Posting» в Google Cloud под аккаунтом канала; включить YouTube Data API v3.
2. Экран согласия OAuth: тип внешний, название RANGE, поддержка и разработчик `catchrange@gmail.com`, ссылки на сайт и политику, область `youtube.upload`.
3. Клиент OAuth (веб-приложение). Секреты вносит владелец в Vercel: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
4. Форма аудита «YouTube API Services — Audit and Quota Extension»: описание «владелец загружает собственные ролики на собственный канал, одним аккаунтом, по расписанию», демо-видео, политика. До одобрения загрузки через API остаются приватными.
5. Квота по умолчанию около 6 загрузок в день: нам хватает (1 в день).

## TikTok (TikTok for Developers, Content Posting API)
1. Приложение «RANGE» (страна и сайт из списка выше), продукты Login Kit и Content Posting API, режим Direct Post.
2. Подтвердить владение `catchrange.com` (запись или файл по инструкции портала).
3. Адреса: политика `/privacy`, условия (см. выше), сайт.
4. Заявка на проверку: описание «публикация собственных роликов владельца на собственный аккаунт, каждый после ручного согласования», демо-видео. До одобрения публикация только приватная.
5. Секреты (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, токены) вносит владелец в Vercel.

## Текст описания для обеих форм (общий)
RANGE (catchrange.com) is a map game for anglers. We run one official account per platform. The owner prepares short videos of real catches and approves every post personally in a private Telegram bot before it is published. We upload only our own videos to our own channel, at most once a day. We never post on behalf of other users and do not collect data from the platform's users.

## Код
Загрузчиков для YouTube и TikTok пока нет: пишутся после одобрения (нужен тот же шаблон, что `web/lib/instagramPublish.ts`).
