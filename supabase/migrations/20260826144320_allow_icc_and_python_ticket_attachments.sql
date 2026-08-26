alter table public."TicketImage"
drop constraint if exists "TicketImage_mimeType_check";

alter table public."TicketImage"
add constraint "TicketImage_mimeType_check"
check (
  "mimeType" in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'application/vnd.iccprofile',
    'text/x-python'
  )
);

update storage.buckets
set allowed_mime_types = array_append(
  array_append(
    array_remove(allowed_mime_types, 'application/vnd.iccprofile'),
    'application/vnd.iccprofile'
  ),
  'text/x-python'
)
where id = 'ticket-images';
