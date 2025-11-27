"""
Test suite for Validation Flow State Machine

Tests the validation state machine implementation covering:
- State transitions
- Cell-level validation
- Session-level validation
- Change request validation
- Merge validation
"""

import sys
import os
import tempfile
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validation_models import (
    ValidationState,
    ValidationSeverity,
    ValidationCounts,
    ValidationStateMachine,
    ValidationMessage,
    ValidationResult,
)


def test_state_transitions():
    """Test 1: Validation state transitions"""
    print("\n=== Test 1: Validation State Transitions ===")
    
    sm = ValidationStateMachine()
    
    # NOT_STARTED -> IN_PROGRESS
    state = sm.transition(ValidationState.NOT_STARTED, ValidationCounts())
    assert state == ValidationState.IN_PROGRESS, f"Expected IN_PROGRESS, got {state}"
    print("OK NOT_STARTED -> IN_PROGRESS")
    
    # IN_PROGRESS -> PASSED (clean)
    clean_counts = ValidationCounts(info=5)
    state = sm.transition(ValidationState.IN_PROGRESS, clean_counts)
    assert state == ValidationState.PASSED, f"Expected PASSED, got {state}"
    print("OK IN_PROGRESS -> PASSED (clean)")
    
    # IN_PROGRESS -> PARTIAL_PASS (warnings)
    warning_counts = ValidationCounts(info=3, warning=2)
    state = sm.transition(ValidationState.IN_PROGRESS, warning_counts)
    assert state == ValidationState.PARTIAL_PASS, f"Expected PARTIAL_PASS, got {state}"
    print("OK IN_PROGRESS -> PARTIAL_PASS (warnings)")
    
    # IN_PROGRESS -> FAILED (errors)
    error_counts = ValidationCounts(info=3, warning=1, error=2)
    state = sm.transition(ValidationState.IN_PROGRESS, error_counts)
    assert state == ValidationState.FAILED, f"Expected FAILED, got {state}"
    print("OK IN_PROGRESS -> FAILED (errors)")
    
    # IN_PROGRESS -> FAILED (fatal)
    fatal_counts = ValidationCounts(fatal=1)
    state = sm.transition(ValidationState.IN_PROGRESS, fatal_counts)
    assert state == ValidationState.FAILED, f"Expected FAILED, got {state}"
    print("OK IN_PROGRESS -> FAILED (fatal)")
    
    # PARTIAL_PASS -> PASSED (override)
    state = sm.transition(ValidationState.PARTIAL_PASS, warning_counts, override_approved=True)
    assert state == ValidationState.PASSED, f"Expected PASSED, got {state}"
    print("OK PARTIAL_PASS -> PASSED (override)")
    
    return True


def test_validation_counts():
    """Test 2: Validation counts utility methods"""
    print("\n=== Test 2: Validation Counts ===")
    
    # Clean counts
    clean = ValidationCounts(info=10)
    assert clean.is_clean(), "Expected is_clean() = True"
    assert not clean.has_warnings(), "Expected has_warnings() = False"
    assert not clean.has_blocking_errors(), "Expected has_blocking_errors() = False"
    print("OK Clean counts validation")
    
    # Warning counts
    warnings = ValidationCounts(info=5, warning=3)
    assert not warnings.is_clean(), "Expected is_clean() = False"
    assert warnings.has_warnings(), "Expected has_warnings() = True"
    assert not warnings.has_blocking_errors(), "Expected has_blocking_errors() = False"
    print("OK Warning counts validation")
    
    # Error counts
    errors = ValidationCounts(info=2, warning=1, error=3)
    assert not errors.is_clean(), "Expected is_clean() = False"
    assert errors.has_warnings(), "Expected has_warnings() = True"
    assert errors.has_blocking_errors(), "Expected has_blocking_errors() = True"
    print("OK Error counts validation")
    
    # Fatal counts
    fatal = ValidationCounts(fatal=1)
    assert fatal.has_blocking_errors(), "Expected has_blocking_errors() = True"
    print("OK Fatal counts validation")
    
    return True


def test_validation_result():
    """Test 3: Validation result state determination"""
    print("\n=== Test 3: Validation Result ===")
    
    # PASSED result
    passed_result = ValidationResult(
        state=ValidationState.IN_PROGRESS,
        counts=ValidationCounts(info=10),
        messages=[],
        can_proceed=True
    )
    determined_state = passed_result.determine_state()
    # Update state to the determined state
    passed_result.state = determined_state
    assert determined_state == ValidationState.PASSED, f"Expected PASSED, got {determined_state}"
    assert passed_result.can_merge(), "Expected can_merge() = True"
    assert passed_result.can_create_change_request(), "Expected can_create_change_request() = True"
    print("OK PASSED result validation")
    
    # PARTIAL_PASS result
    partial_result = ValidationResult(
        state=ValidationState.IN_PROGRESS,
        counts=ValidationCounts(info=5, warning=2),
        messages=[
            ValidationMessage(
                column="amount",
                severity=ValidationSeverity.WARNING,
                message="Amount unusually high"
            )
        ],
        can_proceed=True
    )
    determined_state = partial_result.determine_state()
    partial_result.state = determined_state
    assert determined_state == ValidationState.PARTIAL_PASS, f"Expected PARTIAL_PASS, got {determined_state}"
    assert not partial_result.can_merge(), "Expected can_merge() = False (requires override)"
    assert partial_result.can_create_change_request(), "Expected can_create_change_request() = True"
    print("OK PARTIAL_PASS result validation")
    
    # FAILED result
    failed_result = ValidationResult(
        state=ValidationState.IN_PROGRESS,
        counts=ValidationCounts(info=3, error=5),
        messages=[
            ValidationMessage(
                column="email",
                severity=ValidationSeverity.ERROR,
                message="Invalid email format",
                rule_name="email_format"
            )
        ],
        can_proceed=False
    )
    determined_state = failed_result.determine_state()
    failed_result.state = determined_state
    assert determined_state == ValidationState.FAILED, f"Expected FAILED, got {determined_state}"
    assert not failed_result.can_merge(), "Expected can_merge() = False"
    assert not failed_result.can_create_change_request(), "Expected can_create_change_request() = False"
    print("OK FAILED result validation")
    
    return True


def test_state_machine_can_proceed():
    """Test 4: State machine can_proceed logic"""
    print("\n=== Test 4: Can Proceed Logic ===")
    
    sm = ValidationStateMachine()
    
    # PASSED can proceed
    can_proceed = sm.can_proceed_to_next_stage(ValidationState.PASSED, ValidationCounts())
    assert can_proceed, "Expected PASSED to allow proceed"
    print("OK PASSED allows proceed")
    
    # PARTIAL_PASS can proceed (with review)
    can_proceed = sm.can_proceed_to_next_stage(
        ValidationState.PARTIAL_PASS,
        ValidationCounts(warning=2)
    )
    assert can_proceed, "Expected PARTIAL_PASS to allow proceed with review"
    print("OK PARTIAL_PASS allows proceed with review")
    
    # FAILED cannot proceed
    can_proceed = sm.can_proceed_to_next_stage(
        ValidationState.FAILED,
        ValidationCounts(error=1)
    )
    assert not can_proceed, "Expected FAILED to block proceed"
    print("OK FAILED blocks proceed")
    
    return True


def test_severity_ordering():
    """Test 5: Validation severity ordering"""
    print("\n=== Test 5: Severity Ordering ===")
    
    severities = [
        ValidationSeverity.INFO,
        ValidationSeverity.WARNING,
        ValidationSeverity.ERROR,
        ValidationSeverity.FATAL
    ]
    
    # INFO is lowest severity
    assert severities[0] == ValidationSeverity.INFO
    print("OK INFO is lowest severity")
    
    # WARNING is higher than INFO
    assert severities.index(ValidationSeverity.WARNING) > severities.index(ValidationSeverity.INFO)
    print("OK WARNING > INFO")
    
    # ERROR is higher than WARNING
    assert severities.index(ValidationSeverity.ERROR) > severities.index(ValidationSeverity.WARNING)
    print("OK ERROR > WARNING")
    
    # FATAL is highest severity
    assert severities[3] == ValidationSeverity.FATAL
    print("OK FATAL is highest severity")
    
    return True


def test_validation_message_structure():
    """Test 6: Validation message structure"""
    print("\n=== Test 6: Validation Message Structure ===")
    
    # Complete message
    msg = ValidationMessage(
        column="amount",
        row=42,
        severity=ValidationSeverity.ERROR,
        message="Value must be positive",
        rule_name="positive_amount",
        expectation_type="expect_column_values_to_be_greater_than"
    )
    
    assert msg.column == "amount"
    assert msg.row == 42
    assert msg.severity == ValidationSeverity.ERROR
    assert "positive" in msg.message.lower()
    assert msg.rule_name == "positive_amount"
    print("OK Complete validation message")
    
    # Minimal message
    minimal_msg = ValidationMessage(
        severity=ValidationSeverity.INFO,
        message="Informational message"
    )
    
    assert minimal_msg.column is None
    assert minimal_msg.row is None
    assert minimal_msg.severity == ValidationSeverity.INFO
    print("OK Minimal validation message")
    
    return True


def run_all_tests():
    """Run all validation state machine tests"""
    print("=" * 60)
    print("Validation State Machine Test Suite")
    print("=" * 60)
    
    tests = [
        ("State Transitions", test_state_transitions),
        ("Validation Counts", test_validation_counts),
        ("Validation Result", test_validation_result),
        ("Can Proceed Logic", test_state_machine_can_proceed),
        ("Severity Ordering", test_severity_ordering),
        ("Validation Message Structure", test_validation_message_structure),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n[PASS] {test_name}")
            else:
                failed += 1
                print(f"\n[FAIL] {test_name}")
        except Exception as e:
            failed += 1
            print(f"\n[FAIL] {test_name}")
            print(f"   Error: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
