# Очередь роликов: что делать при каждом запуске (по расписанию, на Mac владельца)

Задача по расписанию читает этот файл и выполняет. Ничего никому не публикуется и не пишется, кроме обновления таблицы `video_jobs`.

1. **Взять задание** (Supabase, проект `yhgdcdkfkerzuhnzjzrz`, SQL):
   `select id, token, src_path, caption_in, status, feedback, caption_out from public.video_jobs where status in ('new','changes') order by id limit 1;`
   Нет строк: сказать «очередь пуста» и закончить.
2. `update public.video_jobs set status='working', updated_at=now() where id=<id>;`
3. Ссылка на исходник: `https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/social-videos/<src_path>`.
4. **Посмотреть видео:** `python3 "/Users/mag/Workspace/Project 1/tools/reels-lab/process_job.py" --look --src-url <ссылка> --name job<id>`; открыть картинку-лист (кадр на каждую секунду, 8 в ряду, номер кадра = секунда), решить:
   - длина итога 15–20 секунд (ориентир, не закон): `--cut "от-до,от-до"` оставляет только нужные куски (поклёвка, вываживание, показ рыбы), скучное вырезать;
   - `--at` секунда, с которой поднимается оболочка «Сектор захвачен» (когда рыба в кадре, и до конца итога должно быть не меньше 6,2 с);
   - не брать расфокусированный или пересвеченный кадр для `--freeze` (держать чёткий кадр рыбы);
   - вид рыбы по картинке и заметке `caption_in`; вес и место только из заметки владельца, не выдумывать.
5. Если `status` был `changes`: учесть `feedback` (и про видео, и про описание), исходные параметры взять заново.
6. **Смонтировать и загрузить:** `python3 "/Users/mag/Workspace/Project 1/tools/reels-lab/process_job.py" --job <id> --token <token> --src-url <ссылка> --species "<рыба>" --weight "<вес>" --cut "..." --freeze N --at N --name job<id>` (печатает `result_path`).
   Посмотреть 5–7 кадров готового ролика из `tools/reels-lab/out/job<id>/reel.mp4` (оболочка читается, текст не налез на лицо, рыба видна).
7. **Описание** (`caption_out`), по-русски, живо, без пафоса, тон как в постах RANGE: 2–3 короткие строки + «Играть: ссылка в шапке профиля 👆» + пустая строка + **не больше 5 хэштегов** (всегда `#catchrange`, остальные по рыбе, по месту, если оно названо, и `#рыбалка`/`#fishing`). Не выдумывать вес, место и детали, слоган «Лови рыбу, захватывай сектора» (не «захватывай воду»). Если был `feedback`, переписать с его учётом.
8. `update public.video_jobs set status='ready', result_path='<result_path>', caption_out='<описание>', sent_at=null, error=null, updated_at=now() where id=<id>;` Бот сам пришлёт ролик владельцу на ближайшем тике.
9. Ошибка на любом шаге: `update ... set status='failed', error='<что случилось>'` и закончить.
