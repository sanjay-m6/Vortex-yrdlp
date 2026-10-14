use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineErrorKind {
    NotFound,
    InvalidPath,
    ExecutionFailed,
    Timeout,
    ProcessAlreadyRunning,
    ProcessNotFound,
    ParseError,
    PermissionDenied,
    Io,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EngineError {
    pub kind: EngineErrorKind,
    pub message: String,
}

impl EngineError {
    pub fn new(kind: EngineErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::NotFound, msg)
    }

    pub fn invalid_path(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::InvalidPath, msg)
    }

    pub fn execution_failed(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::ExecutionFailed, msg)
    }

    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::Timeout, msg)
    }

    pub fn duplicate_process(id: impl Into<String>) -> Self {
        Self::new(
            EngineErrorKind::ProcessAlreadyRunning,
            format!("Process with ID '{}' is already running", id.into()),
        )
    }

    pub fn process_not_found(id: impl Into<String>) -> Self {
        Self::new(
            EngineErrorKind::ProcessNotFound,
            format!("Managed process '{}' not found", id.into()),
        )
    }

    pub fn parse_error(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::ParseError, msg)
    }

    pub fn permission_denied(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::PermissionDenied, msg)
    }

    pub fn io(msg: impl Into<String>) -> Self {
        Self::new(EngineErrorKind::Io, msg)
    }
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for EngineError {}

impl From<std::io::Error> for EngineError {
    fn from(err: std::io::Error) -> Self {
        if err.kind() == std::io::ErrorKind::PermissionDenied {
            Self::permission_denied(err.to_string())
        } else if err.kind() == std::io::ErrorKind::NotFound {
            Self::not_found(err.to_string())
        } else {
            Self::io(err.to_string())
        }
    }
}

impl From<EngineError> for String {
    fn from(err: EngineError) -> Self {
        err.to_string()
    }
}
