import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppFooter, formatAppVersion } from '../AppFooter';

describe('formatAppVersion', () => {
  it('prefixes raw semver strings with v', () => {
    expect(formatAppVersion('1.5.0')).toBe('v1.5.0');
  });

  it('preserves existing v prefix', () => {
    expect(formatAppVersion('v1.5.0')).toBe('v1.5.0');
  });

  it('falls back to v0.1.0 when empty or undefined', () => {
    expect(formatAppVersion(undefined)).toBe('v0.1.0');
    expect(formatAppVersion('   ')).toBe('v0.1.0');
  });
});

describe('AppFooter', () => {
  it('renders the formatted version string in the footer', () => {
    render(<AppFooter version="1.5.0" buildSha="abc1234" />);

    const footer = screen.getByTestId('app-footer');
    expect(footer).toBeInTheDocument();

    const versionEl = screen.getByTestId('app-version');
    expect(versionEl).toHaveTextContent('v1.5.0');
    expect(versionEl).toHaveAttribute('title', 'MHC Portal v1.5.0 (abc1234)');
  });

  it('omits commit SHA from title when buildSha is empty', () => {
    render(<AppFooter version="1.5.0" buildSha="" />);

    const versionEl = screen.getByTestId('app-version');
    expect(versionEl).toHaveAttribute('title', 'MHC Portal v1.5.0');
  });
});
