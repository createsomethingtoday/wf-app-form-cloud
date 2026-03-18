import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Quill from 'quill';

const EMPTY_DOCUMENT = '<p><br></p>';

const QuillEditor = forwardRef(function QuillEditor(
  {
    className,
    formats,
    modules,
    onChange,
    placeholder,
    style,
    theme = 'snow',
    value = '',
  },
  ref
) {
  const editorHostRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
  }));

  useEffect(() => {
    if (!editorHostRef.current || editorRef.current) {
      return undefined;
    }

    const editor = new Quill(editorHostRef.current, {
      formats,
      modules,
      placeholder,
      theme,
    });

    editor.root.innerHTML = value || EMPTY_DOCUMENT;

    const handleTextChange = () => {
      onChangeRef.current?.(editor.root.innerHTML);
    };

    editor.on('text-change', handleTextChange);
    editorRef.current = editor;

    return () => {
      editor.off('text-change', handleTextChange);
      editorRef.current = null;
      if (editorHostRef.current) {
        editorHostRef.current.innerHTML = '';
      }
    };
  }, [formats, modules, placeholder, theme, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextValue = value || EMPTY_DOCUMENT;
    if (editor.root.innerHTML !== nextValue) {
      const selection = editor.getSelection();
      editor.root.innerHTML = nextValue;
      if (selection) {
        editor.setSelection(selection);
      }
    }
  }, [value]);

  return (
    <div className={className} style={style}>
      <div ref={editorHostRef} />
    </div>
  );
});

export default QuillEditor;
