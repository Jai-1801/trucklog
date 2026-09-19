class ProviderError(Exception):
    """A failure we can explain to the user. Views render it as
    {"error": {"code", "message"}} with `status`."""

    def __init__(self, code: str, message: str, status: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
