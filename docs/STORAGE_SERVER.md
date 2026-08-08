# Alazab Data Platform — Server-First Storage

## القاعدة

الهوية مملوكة للعزب وليست لمزود التخزين:

- `RQ-*` = سياق ما قبل الأصل.
- `PRJ-*` = أصل مشروع رسمي بعد التحقق من الاستلام المالي للدفعة الأولى.
- `OBJ-*` = هوية كائن ثابتة.
- `https://alazab.com/Projects/PRJ-*` = العنوان المؤسسي الدائم للمشروع.
- `Provider / Bucket / Path / Filename` = مواقع أو خصائص تشغيلية فقط، وليست هوية.

المسار المفضل هو:

```text
User / App / Agent
        ↓
Alazab Data Platform Server
        ↓
OBJ Resolver
        ↓
Direct Server Copy (when available)
        ↓
External Storage Targets only when required
```

## إعداد التخزين المباشر على السيرفر

يحتاج Runtime إلى:

```bash
ADP_STORAGE_ROOT=/var/lib/alazab-data/storage
ADP_SERVER_UPLOAD_MAX_MB=128
```

أنشئ المسار على السيرفر باستخدام مستخدم خدمة التطبيق الفعلي، وليس root كتخمين:

```bash
sudo install -d -o <ADP_APP_USER> -g <ADP_APP_GROUP> -m 0750 /var/lib/alazab-data/storage
```

ثم أضف `ADP_STORAGE_ROOT` إلى بيئة خدمة Alazab Data Platform وأعد تشغيل الخدمة بالطريقة المعتمدة في بيئة النشر.

> `ADP_STORAGE_ROOT` هو Physical Location فقط. تغييره لا يغيّر أي `RQ`, `PRJ`, `OBJ` أو Canonical URI.

## طريقة حفظ الملفات

الاسم الفيزيائي على السيرفر لا يعتمد على اسم الملف الذي يرفعه المستخدم. يتم حجز `OBJ` أولاً، ثم يحفظ الجسم كالتالي:

```text
/var/lib/alazab-data/storage/
  OBJ-2026-08-000001
  OBJ-2026-08-000002
  OBJ-2026-08-000003
```

اسم المستخدم الأصلي محفوظ كـMetadata فقط.

## سلامة البيانات

عند الرفع:

1. يحسب SHA-256.
2. يحجز `OBJ` ثابتًا.
3. يكتب الملف مباشرة على السيرفر بـ`wx` لمنع overwrite.
4. يسجل Object + Server Location في Registry.
5. إذا فشل تسجيل قاعدة البيانات يحذف الجسم الذي تمت كتابته في نفس العملية.

عند التنزيل المباشر:

1. يحل `OBJ` إلى أفضل Location.
2. يجب أن تكون نسخة السيرفر `available`.
3. يقرأ الجسم من السيرفر.
4. يعيد حساب SHA-256 قبل الإرسال.
5. يرفض التنزيل عند فشل المطابقة.

## Project Promotion Gate

`RQ` لا يصبح مشروعًا عند عرض السعر أو التوقيع أو إصدار الفاتورة. التحويل إلى `PRJ` يتم فقط عبر `promote_storage_request` بعد وجود استلام مالي فعلي تم التحقق منه.

العملية تحفظ `origin_request_id` وتحوّل الملكية الحالية للكائنات إلى `PRJ` بدون تغيير `OBJ`.

## المزودون الخارجيون

`storage_endpoints` يبقى Infrastructure Registry. أي AWS / OCI / GCS / Azure / MinIO يضاف لاحقًا كـLocation أو Replica لنفس `OBJ` ولا يغير هوية الأصل.
