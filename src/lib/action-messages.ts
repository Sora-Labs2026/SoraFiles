import type { WorkbenchMessages } from '../i18n/workbench';

type NoTextMessages = Pick<WorkbenchMessages, 'noReadableText' | 'noTextAfterOcr'>;

export function noTextMessageForTool(tool: string, messages: NoTextMessages): string {
  return tool === 'pdf-to-word' ? messages.noTextAfterOcr : messages.noReadableText;
}

export function localizedNoTextStatus(tool: string, value: string, messages: NoTextMessages): string | null {
  return /no selectable text|no readable text/iu.test(value) ? noTextMessageForTool(tool, messages) : null;
}
