"""Bound PDF parsing in a disposable process; never trust uploaded PDF contents."""
import io
import multiprocessing


def _parse_pdf(data: bytes, connection):
    try:
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))
        except (ImportError, ValueError, OSError):
            pass  # Windows uses the process timeout; Linux also has a memory cap.
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            connection.send((False, "Vui lòng tải PDF không có mật khẩu"))
            return
        if len(reader.pages) > 40:
            connection.send((False, "Tài liệu tối đa 40 trang"))
            return
        parts = []
        remaining = 50000
        for page in reader.pages:
            if remaining <= 0:
                break
            part = (page.extract_text() or "")[:remaining]
            parts.append(part)
            remaining -= len(part)
        connection.send((True, "\n".join(parts)))
    except Exception:
        connection.send((False, "Không thể đọc PDF. Vui lòng kiểm tra tài liệu."))
    finally:
        connection.close()


def extract_pdf_text(data: bytes) -> str:
    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(target=_parse_pdf, args=(data, sender), daemon=True)
    process.start()
    sender.close()
    try:
        if not receiver.poll(8):
            raise ValueError("PDF xử lý quá lâu. Vui lòng dùng tài liệu đơn giản hơn.")
        try:
            success, result = receiver.recv()
        except EOFError:
            raise ValueError("Không thể xử lý PDF trong giới hạn tài nguyên")
        if not success:
            raise ValueError(result)
        return result
    finally:
        receiver.close()
        if process.is_alive():
            process.terminate()
        process.join(timeout=1)
