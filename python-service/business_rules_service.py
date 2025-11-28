"""
Business Rules Validation Service using Great Expectations

This service provides:
- Conversion of Oreo business rules to GE expectation suites
- Cell-level validation for live edit with real-time feedback
- Row-level and batch validation for appends
- Severity mapping (info/warning/error/fatal)
"""

import json
import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import great_expectations as gx
    from great_expectations.core import ExpectationSuite, ExpectationConfiguration
    from great_expectations.core.batch import RuntimeBatchRequest
    from great_expectations.data_context import EphemeralDataContext
    from great_expectations.data_context.types.base import (
        DataContextConfig,
        InMemoryStoreBackendDefaults,
    )
    GE_AVAILABLE = True
except ImportError:
    GE_AVAILABLE = False
    gx = None

logger = logging.getLogger("business_rules_service")


class ValidationSeverity(str, Enum):
    """Validation result severities"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    FATAL = "fatal"


class CellValidationError(BaseModel):
    """Single cell validation error"""
    column: str
    row_index: Optional[int] = None
    row_id: Optional[Union[str, int]] = None
    severity: ValidationSeverity
    rule_type: str
    message: str
    expected_value: Optional[str] = None
    actual_value: Optional[Any] = None


class CellValidationResult(BaseModel):
    """Result of cell-level validation"""
    valid: bool
    errors: List[CellValidationError] = []
    column: str
    value: Any
    row_id: Optional[Union[str, int]] = None


class BatchValidationResult(BaseModel):
    """Result of batch validation (multiple rows)"""
    valid: bool
    error_count: int
    warning_count: int
    errors: List[CellValidationError] = []
    summary: Dict[str, Any] = {}


class BusinessRulesService:
    """
    Service for validating data against business rules using Great Expectations.
    
    Supports rule types:
    - required: Column must have non-null/non-empty values
    - readonly: Column cannot be edited (enforced at UI level)
    - greater_than: Numeric values must be > threshold
    - less_than: Numeric values must be < threshold
    - between: Numeric values must be within range [min, max]
    - equals: Values must equal a specific value
    - not_contains: String values must not contain a specific substring
    - range: Alias for between (legacy support)
    """

    def __init__(self):
        self._context = None
        self._init_ge_context()

    def _init_ge_context(self):
        """Initialize GE ephemeral context for validation"""
        if not GE_AVAILABLE:
            logger.warning("Great Expectations not available, using fallback validation")
            return

        try:
            # Create ephemeral context (in-memory, no file persistence)
            self._context = gx.get_context()
        except Exception as e:
            logger.warning(f"Failed to initialize GE context: {e}, using fallback validation")
            self._context = None

    def rules_to_expectations(self, rules: List[Dict[str, Any]], columns_schema: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Convert Oreo business rules to Great Expectations expectation configs.
        
        Args:
            rules: List of Oreo rule definitions
            columns_schema: Optional schema with column types
            
        Returns:
            List of GE expectation configuration dicts
        """
        expectations = []

        for rule in rules:
            rule_type = rule.get("type")

            if rule_type == "required":
                # Required columns must not be null or empty
                columns = rule.get("columns", [])
                for col in columns:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_not_be_null",
                        "kwargs": {"column": col},
                        "meta": {
                            "rule_type": "required",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' is required"
                        }
                    })

            elif rule_type == "greater_than":
                col = rule.get("column")
                value = rule.get("value")
                if col and value is not None:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_between",
                        "kwargs": {
                            "column": col,
                            "min_value": float(value),
                            "max_value": None,
                            "strict_min": True  # Greater than (not equal)
                        },
                        "meta": {
                            "rule_type": "greater_than",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must be greater than {value}",
                            "threshold": value
                        }
                    })

            elif rule_type == "less_than":
                col = rule.get("column")
                value = rule.get("value")
                if col and value is not None:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_between",
                        "kwargs": {
                            "column": col,
                            "min_value": None,
                            "max_value": float(value),
                            "strict_max": True  # Less than (not equal)
                        },
                        "meta": {
                            "rule_type": "less_than",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must be less than {value}",
                            "threshold": value
                        }
                    })

            elif rule_type in ("between", "range"):
                col = rule.get("column")
                min_val = rule.get("min") or rule.get("value")
                max_val = rule.get("max") or rule.get("value2")
                if col and (min_val is not None or max_val is not None):
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_between",
                        "kwargs": {
                            "column": col,
                            "min_value": float(min_val) if min_val is not None else None,
                            "max_value": float(max_val) if max_val is not None else None
                        },
                        "meta": {
                            "rule_type": "between",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must be between {min_val} and {max_val}",
                            "min": min_val,
                            "max": max_val
                        }
                    })

            elif rule_type == "equals":
                col = rule.get("column")
                value = rule.get("value")
                if col and value is not None:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_in_set",
                        "kwargs": {
                            "column": col,
                            "value_set": [value]
                        },
                        "meta": {
                            "rule_type": "equals",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must equal {value}",
                            "expected": value
                        }
                    })

            elif rule_type == "unique":
                col = rule.get("column")
                if col:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_unique",
                        "kwargs": {"column": col},
                        "meta": {
                            "rule_type": "unique",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must have unique values"
                        }
                    })

            elif rule_type == "regex":
                col = rule.get("column")
                pattern = rule.get("pattern")
                if col and pattern:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_match_regex",
                        "kwargs": {
                            "column": col,
                            "regex": pattern
                        },
                        "meta": {
                            "rule_type": "regex",
                            "severity": rule.get("severity", "error"),
                            "message": f"'{col}' must match pattern {pattern}"
                        }
                    })

            elif rule_type in ("allowed_values", "ref_in"):
                col = rule.get("column")
                values = rule.get("values", [])
                if col and values:
                    expectations.append({
                        "expectation_type": "expect_column_values_to_be_in_set",
                        "kwargs": {
                            "column": col,
                            "value_set": values
                        },
                        "meta": {
                            "rule_type": "allowed_values",
                            "severity": rule.get("severity", "warning"),
                            "message": f"'{col}' must be one of: {values}"
                        }
                    })

            # readonly is enforced at UI level, not validated here

        return expectations

    def validate_cell(
        self,
        column: str,
        value: Any,
        rules: List[Dict[str, Any]],
        row_id: Optional[Union[str, int]] = None,
        row_data: Optional[Dict[str, Any]] = None
    ) -> CellValidationResult:
        """
        Validate a single cell value against business rules.
        
        This provides real-time validation feedback during live editing.
        
        Args:
            column: Column name being edited
            value: New value for the cell
            rules: List of business rules for this dataset
            row_id: Optional row identifier
            row_data: Optional full row data for context-dependent validation
            
        Returns:
            CellValidationResult with validation status and any errors
        """
        errors: List[CellValidationError] = []

        # Filter rules that apply to this column
        column_rules = self._get_column_rules(column, rules)

        for rule in column_rules:
            rule_type = rule.get("type")
            error = self._validate_single_value(column, value, rule, row_id)
            if error:
                errors.append(error)

        return CellValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            column=column,
            value=value,
            row_id=row_id
        )

    def _get_column_rules(self, column: str, rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract rules that apply to a specific column"""
        column_rules = []
        for rule in rules:
            rule_type = rule.get("type")

            # Rules with 'column' field
            if rule.get("column") == column:
                column_rules.append(rule)
            # Rules with 'columns' list
            elif column in rule.get("columns", []):
                column_rules.append(rule)

        return column_rules

    def _validate_single_value(
        self,
        column: str,
        value: Any,
        rule: Dict[str, Any],
        row_id: Optional[Union[str, int]] = None
    ) -> Optional[CellValidationError]:
        """Validate a single value against a single rule"""
        rule_type = rule.get("type")
        severity = ValidationSeverity(rule.get("severity", "error"))

        # Required check
        if rule_type == "required":
            if value is None or (isinstance(value, str) and value.strip() == ""):
                return CellValidationError(
                    column=column,
                    row_id=row_id,
                    severity=severity,
                    rule_type=rule_type,
                    message=f"'{column}' is required",
                    actual_value=value
                )

        # Skip validation for null values on non-required fields
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return None

        # Numeric validations
        if rule_type == "greater_than":
            threshold = rule.get("value")
            if threshold is not None:
                try:
                    num_value = float(value)
                    if num_value <= float(threshold):
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' must be greater than {threshold}",
                            expected_value=f"> {threshold}",
                            actual_value=value
                        )
                except (ValueError, TypeError):
                    return CellValidationError(
                        column=column,
                        row_id=row_id,
                        severity=severity,
                        rule_type=rule_type,
                        message=f"'{column}' must be a valid number",
                        actual_value=value
                    )

        elif rule_type == "less_than":
            threshold = rule.get("value")
            if threshold is not None:
                try:
                    num_value = float(value)
                    if num_value >= float(threshold):
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' must be less than {threshold}",
                            expected_value=f"< {threshold}",
                            actual_value=value
                        )
                except (ValueError, TypeError):
                    return CellValidationError(
                        column=column,
                        row_id=row_id,
                        severity=severity,
                        rule_type=rule_type,
                        message=f"'{column}' must be a valid number",
                        actual_value=value
                    )

        elif rule_type in ("between", "range"):
            min_val = rule.get("min") or rule.get("value")
            max_val = rule.get("max") or rule.get("value2")
            try:
                num_value = float(value)
                if min_val is not None and num_value < float(min_val):
                    return CellValidationError(
                        column=column,
                        row_id=row_id,
                        severity=severity,
                        rule_type=rule_type,
                        message=f"'{column}' must be at least {min_val}",
                        expected_value=f">= {min_val}",
                        actual_value=value
                    )
                if max_val is not None and num_value > float(max_val):
                    return CellValidationError(
                        column=column,
                        row_id=row_id,
                        severity=severity,
                        rule_type=rule_type,
                        message=f"'{column}' must be at most {max_val}",
                        expected_value=f"<= {max_val}",
                        actual_value=value
                    )
            except (ValueError, TypeError):
                return CellValidationError(
                    column=column,
                    row_id=row_id,
                    severity=severity,
                    rule_type=rule_type,
                    message=f"'{column}' must be a valid number",
                    actual_value=value
                )

        elif rule_type == "equals":
            expected = rule.get("value")
            if expected is not None:
                # Type-aware comparison
                try:
                    if isinstance(expected, (int, float)):
                        if float(value) != float(expected):
                            return CellValidationError(
                                column=column,
                                row_id=row_id,
                                severity=severity,
                                rule_type=rule_type,
                                message=f"'{column}' must equal {expected}",
                                expected_value=str(expected),
                                actual_value=value
                            )
                    elif str(value) != str(expected):
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' must equal {expected}",
                            expected_value=str(expected),
                            actual_value=value
                        )
                except (ValueError, TypeError):
                    if str(value) != str(expected):
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' must equal {expected}",
                            expected_value=str(expected),
                            actual_value=value
                        )

        elif rule_type == "not_contains":
            # Support both single value and array of values
            forbidden_values = rule.get("values", [])
            single_value = rule.get("value")
            if single_value and not forbidden_values:
                forbidden_values = [single_value]
            
            if forbidden_values:
                str_value = str(value).lower()
                for forbidden in forbidden_values:
                    if forbidden and str(forbidden).lower() in str_value:
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' must not contain '{forbidden}'",
                            expected_value=f"not contain '{forbidden}'",
                            actual_value=value
                        )

        elif rule_type == "regex":
            import re
            pattern = rule.get("pattern")
            if pattern:
                try:
                    if not re.fullmatch(pattern, str(value)):
                        return CellValidationError(
                            column=column,
                            row_id=row_id,
                            severity=severity,
                            rule_type=rule_type,
                            message=f"'{column}' does not match required pattern",
                            expected_value=f"pattern: {pattern}",
                            actual_value=value
                        )
                except re.error:
                    pass  # Invalid regex, skip validation

        elif rule_type in ("allowed_values", "ref_in"):
            allowed = rule.get("values", [])
            if allowed and value not in allowed:
                return CellValidationError(
                    column=column,
                    row_id=row_id,
                    severity=severity,
                    rule_type=rule_type,
                    message=f"'{column}' must be one of: {', '.join(map(str, allowed[:5]))}{'...' if len(allowed) > 5 else ''}",
                    expected_value=f"one of {len(allowed)} allowed values",
                    actual_value=value
                )

        return None

    def validate_rows(
        self,
        rows: List[Dict[str, Any]],
        rules: List[Dict[str, Any]],
        use_ge: bool = True
    ) -> BatchValidationResult:
        """
        Validate multiple rows against business rules.
        
        Uses Great Expectations for batch validation when available,
        falls back to manual validation otherwise.
        
        Args:
            rows: List of row dictionaries to validate
            rules: List of business rules
            use_ge: Whether to use GE (True) or fallback validation (False)
            
        Returns:
            BatchValidationResult with all errors found
        """
        errors: List[CellValidationError] = []

        if use_ge and GE_AVAILABLE and pd is not None and self._context is not None:
            errors = self._validate_with_ge(rows, rules)
        else:
            errors = self._validate_manual(rows, rules)

        # Count by severity
        error_count = sum(1 for e in errors if e.severity in [ValidationSeverity.ERROR, ValidationSeverity.FATAL])
        warning_count = sum(1 for e in errors if e.severity == ValidationSeverity.WARNING)

        # Generate summary by column
        summary: Dict[str, Any] = {}
        for error in errors:
            if error.column not in summary:
                summary[error.column] = {"errors": 0, "warnings": 0, "rules_violated": set()}
            if error.severity in [ValidationSeverity.ERROR, ValidationSeverity.FATAL]:
                summary[error.column]["errors"] += 1
            elif error.severity == ValidationSeverity.WARNING:
                summary[error.column]["warnings"] += 1
            summary[error.column]["rules_violated"].add(error.rule_type)

        # Convert sets to lists for JSON serialization
        for col in summary:
            summary[col]["rules_violated"] = list(summary[col]["rules_violated"])

        return BatchValidationResult(
            valid=error_count == 0,
            error_count=error_count,
            warning_count=warning_count,
            errors=errors,
            summary=summary
        )

    def _validate_with_ge(
        self,
        rows: List[Dict[str, Any]],
        rules: List[Dict[str, Any]]
    ) -> List[CellValidationError]:
        """Run validation using Great Expectations"""
        errors = []

        try:
            # Convert to DataFrame
            df = pd.DataFrame(rows)
            if df.empty:
                return errors

            # Convert rules to expectations
            expectations = self.rules_to_expectations(rules)

            # Create expectation suite
            suite = gx.ExpectationSuite(name="validation_suite")
            for exp_config in expectations:
                suite.add_expectation(
                    gx.expectations.ExpectationConfiguration(
                        expectation_type=exp_config["expectation_type"],
                        kwargs=exp_config["kwargs"],
                        meta=exp_config.get("meta", {})
                    )
                )

            # Create validator with the DataFrame
            validator = self._context.sources.pandas_default.read_dataframe(df)
            
            # Run validation
            results = validator.validate(suite)

            # Parse results
            for result in results.results:
                if not result.success:
                    exp_config = result.expectation_config
                    meta = exp_config.meta or {}
                    column = exp_config.kwargs.get("column", "unknown")
                    severity = ValidationSeverity(meta.get("severity", "error"))
                    rule_type = meta.get("rule_type", exp_config.expectation_type)
                    message = meta.get("message", f"Validation failed for '{column}'")

                    # Get unexpected values/indices if available
                    unexpected_list = result.result.get("unexpected_list", [])
                    unexpected_index_list = result.result.get("unexpected_index_list", [])

                    if unexpected_index_list:
                        for idx in unexpected_index_list[:100]:  # Limit to 100 errors
                            actual_val = rows[idx].get(column) if idx < len(rows) else None
                            errors.append(CellValidationError(
                                column=column,
                                row_index=idx,
                                severity=severity,
                                rule_type=rule_type,
                                message=message,
                                actual_value=actual_val
                            ))
                    else:
                        # No specific row info, report general error
                        errors.append(CellValidationError(
                            column=column,
                            severity=severity,
                            rule_type=rule_type,
                            message=message
                        ))

        except Exception as e:
            logger.error(f"GE validation failed: {e}, falling back to manual validation")
            errors = self._validate_manual(rows, rules)

        return errors

    def _validate_manual(
        self,
        rows: List[Dict[str, Any]],
        rules: List[Dict[str, Any]]
    ) -> List[CellValidationError]:
        """Manual validation fallback when GE is not available"""
        errors = []

        for idx, row in enumerate(rows):
            row_id = row.get("_row_id", idx)
            for col, value in row.items():
                if col.startswith("_"):  # Skip internal columns
                    continue
                column_rules = self._get_column_rules(col, rules)
                for rule in column_rules:
                    error = self._validate_single_value(col, value, rule, row_id)
                    if error:
                        error.row_index = idx
                        errors.append(error)

        return errors


# Global instance
_business_rules_service: Optional[BusinessRulesService] = None


def get_business_rules_service() -> BusinessRulesService:
    """Get or create the global BusinessRulesService instance"""
    global _business_rules_service
    if _business_rules_service is None:
        _business_rules_service = BusinessRulesService()
    return _business_rules_service
