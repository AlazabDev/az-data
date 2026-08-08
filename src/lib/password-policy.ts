export const PASSWORD_POLICY = {
  minLength: 15,
  maxLength: 20,
  allowed: /^[A-Za-z0-9$#_]+$/,
  first: /^[A-Za-z$#]/,
};

export function validatePlatformPassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_POLICY.minLength || password.length > PASSWORD_POLICY.maxLength) errors.push("length");
  if (!PASSWORD_POLICY.allowed.test(password)) errors.push("allowed_chars");
  if (!PASSWORD_POLICY.first.test(password)) errors.push("first_char");
  if (password.length >= 3 && password[0] === password[1] && password[1] === password[2]) errors.push("first_three_same");
  if (!/[a-z]/.test(password)) errors.push("lowercase");
  if (!/[A-Z]/.test(password)) errors.push("uppercase");
  if (!/[0-9]/.test(password)) errors.push("number");
  if (!/[$#_]/.test(password)) errors.push("special");
  return errors;
}

export function passwordPolicyMessage(code: string, lang: "ar" | "en") {
  const messages: Record<string, { ar: string; en: string }> = {
    length: { ar: "يجب أن تكون كلمة المرور بين 15 و20 حرفًا.", en: "Password must be 15 to 20 characters." },
    allowed_chars: { ar: "الأحرف المسموحة فقط: A-Z، a-z، 0-9، $، #، _.", en: "Allowed characters only: A-Z, a-z, 0-9, $, #, _." },
    first_char: { ar: "يجب أن يبدأ الحرف الأول بـ A-Z أو a-z أو $ أو #.", en: "The first character must be A-Z, a-z, $, or #." },
    first_three_same: { ar: "لا يجوز أن تكون أول ثلاثة أحرف متطابقة.", en: "The first three characters cannot all be identical." },
    lowercase: { ar: "يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل.", en: "Password must contain at least one lowercase letter." },
    uppercase: { ar: "يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل.", en: "Password must contain at least one uppercase letter." },
    number: { ar: "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.", en: "Password must contain at least one number." },
    special: { ar: "يجب أن تحتوي كلمة المرور على حرف خاص واحد على الأقل من: $ أو # أو _.", en: "Password must contain at least one of: $, #, _." },
  };
  return messages[code]?.[lang] ?? code;
}
