// Presentation groups follow the locked website prototype. Engine capabilities
// remain the authority for which tools are available in the Desktop app.
export const toolCategories = [
 {id:'pdf',label:'PDF',tools:['compress-pdf','merge-pdf','split-pdf','rotate-pdf','remove-pages','watermark-pdf','page-numbers','sign-pdf','repair-pdf','pdf-ocr']},
 {id:'convert',label:'Convert',tools:['jpg-to-pdf','pdf-to-jpg','pdf-to-word','word-to-pdf','heic-to-jpg','image-converter','pdf-to-excel','excel-to-pdf']},
 {id:'image',label:'Image',tools:['compress-image','edit-image','remove-background','resize-image','doc-scanner']},
 {id:'security',label:'Security',tools:['protect-pdf','metadata-remover']},
] as const;
