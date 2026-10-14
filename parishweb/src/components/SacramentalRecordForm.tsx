import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../api/client'

type RecordType = 'baptism' | 'confirmation' | 'marriage' | 'death'
type FormValue = string | number

type Props = {
  type: RecordType
  record?: Record<string, unknown> | null
  adminToken: string
  onSaved: () => void
  onCancel: () => void
}

const fields: Record<RecordType, Array<{ key: string; label: string; type?: 'date' | 'number' | 'textarea' }>> = {
  baptism: [
    { key: 'registryNumber', label: 'Registry number' }, { key: 'childFirstName', label: 'Child first name' }, { key: 'childMiddleName', label: 'Child middle name' }, { key: 'childLastName', label: 'Child last name' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { key: 'placeOfBirth', label: 'Place of birth' }, { key: 'dateOfBaptism', label: 'Date of baptism', type: 'date' },
    { key: 'fatherFullName', label: "Father's full name" }, { key: 'motherFullName', label: "Mother's full name" }, { key: 'ministerName', label: 'Minister name' }, { key: 'sponsors', label: 'Sponsors', type: 'textarea' }, { key: 'remarks', label: 'Remarks', type: 'textarea' },
  ],
  confirmation: [
    { key: 'registryNumber', label: 'Registry number' }, { key: 'candidateFirstName', label: 'Candidate first name' }, { key: 'candidateMiddleName', label: 'Candidate middle name' }, { key: 'candidateLastName', label: 'Candidate last name' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { key: 'dateOfConfirmation', label: 'Date of confirmation', type: 'date' }, { key: 'fatherFullName', label: "Father's full name" }, { key: 'motherFullName', label: "Mother's full name" },
    { key: 'sponsorName', label: 'Sponsor name' }, { key: 'bishopOrMinister', label: 'Bishop or minister' }, { key: 'parishOfBaptism', label: 'Parish of baptism' },
  ],
  marriage: [
    { key: 'registryNumber', label: 'Registry number' }, { key: 'groomFirstName', label: 'Groom first name' }, { key: 'groomMiddleName', label: 'Groom middle name' }, { key: 'groomLastName', label: 'Groom last name' }, { key: 'groomAge', label: 'Groom age', type: 'number' }, { key: 'groomParents', label: 'Groom parents' },
    { key: 'brideFirstName', label: 'Bride first name' }, { key: 'brideMiddleName', label: 'Bride middle name' }, { key: 'brideLastName', label: 'Bride last name' }, { key: 'brideAge', label: 'Bride age', type: 'number' }, { key: 'brideParents', label: 'Bride parents' },
    { key: 'dateOfMarriage', label: 'Date of marriage', type: 'date' }, { key: 'witnesses', label: 'Witnesses', type: 'textarea' }, { key: 'solemnizingPriest', label: 'Solemnizing priest' },
  ],
  death: [
    { key: 'registryNumber', label: 'Registry number' }, { key: 'deceasedFirstName', label: 'Deceased first name' }, { key: 'deceasedMiddleName', label: 'Deceased middle name' }, { key: 'deceasedLastName', label: 'Deceased last name' }, { key: 'age', label: 'Age', type: 'number' },
    { key: 'dateOfDeath', label: 'Date of death', type: 'date' }, { key: 'dateOfBurial', label: 'Date of burial', type: 'date' }, { key: 'causeOfDeath', label: 'Cause of death' }, { key: 'placeOfBurial', label: 'Place of burial' }, { key: 'sacramentsReceived', label: 'Sacraments received', type: 'textarea' }, { key: 'officiatingPriest', label: 'Officiating priest' },
  ],
}

function initialValues(type: RecordType, record?: Record<string, unknown> | null): Record<string, FormValue> {
  return Object.fromEntries(fields[type].map(field => {
    const value = record?.[field.key] ?? record?.[field.key.charAt(0).toUpperCase() + field.key.slice(1)] ?? ''
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '')
    return [field.key, field.type === 'date' ? text.slice(0, 10) : text]
  }))
}

export function SacramentalRecordForm({ type, record, adminToken, onSaved, onCancel }: Props) {
  const [selectedType, setSelectedType] = useState(type)
  const [valuesByType, setValuesByType] = useState<Partial<Record<RecordType, Record<string, FormValue>>>>(() => ({
    [type]: initialValues(type, record),
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(record)
  const values = valuesByType[selectedType] ?? initialValues(selectedType)
  const recordTypeLabel = selectedType.charAt(0).toUpperCase() + selectedType.slice(1)
  const updateValue = (key: string, value: FormValue) => {
    setValuesByType(previous => ({
      ...previous,
      [selectedType]: { ...values, [key]: value },
    }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]))
      if (isEditing && record) {
        const updatePayload = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key.charAt(0).toUpperCase() + key.slice(1), value]))
        await apiClient.sacramental.update(selectedType, Number(record.Id ?? record[`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}Id`]), updatePayload, adminToken)
      } else {
        await apiClient.sacramental.create(selectedType, payload, adminToken)
      }
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save sacramental record.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="sacramental-record-form" aria-label="Sacramental record form" onSubmit={submit}>
    <div className="detail-header sacramental-form-header">
      <div>
        <p className="sacramental-form-kicker">{isEditing ? 'Update parish register' : 'New parish register entry'}</p>
        <h3 id="sacramental-form-title">{isEditing ? `Edit ${recordTypeLabel} record` : 'Add sacramental record'}</h3>
      </div>
      <button type="button" className="close-btn" aria-label="Close form" onClick={onCancel}>×</button>
    </div>
    {!isEditing && (
      <div className="sacramental-form-type">
        <label htmlFor="new-record-sacrament">Sacrament type</label>
        <select
          id="new-record-sacrament"
          value={selectedType}
          disabled={saving}
          onChange={event => {
            const nextType = event.target.value as RecordType
            setSelectedType(nextType)
          }}
        >
          <option value="baptism">Baptism</option>
          <option value="confirmation">Confirmation</option>
          <option value="marriage">Marriage</option>
          <option value="death">Death</option>
        </select>
        <p>Choose the sacrament to see the fields for that record.</p>
      </div>
    )}
    <div className="sacramental-form-grid">
      {fields[selectedType].map(field => (
        <label key={field.key}>
          {field.label}
          {field.type === 'textarea' ? (
            <textarea
              required={!field.key.includes('Middle') && !['remarks', 'sponsors', 'witnesses', 'notes'].includes(field.key)}
              value={String(values[field.key] ?? '')}
              onChange={event => updateValue(field.key, event.target.value)}
            />
          ) : (
            <input
              required={!field.key.toLowerCase().includes('middle') && !['placeOfBirth', 'fatherFullName', 'motherFullName', 'placeOfBurial', 'causeOfDeath', 'dateOfBurial', 'groomParents', 'brideParents', 'parishOfBaptism', 'sponsorName'].includes(field.key)}
              type={field.type || 'text'}
              min={field.type === 'number' ? 0 : undefined}
              value={String(values[field.key] ?? '')}
              onChange={event => updateValue(field.key, event.target.value)}
            />
          )}
        </label>
      ))}
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="sacramental-form-actions">
      <button type="submit" className="sacramental-save-button" disabled={saving}>
        {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save record'}
      </button>
      <button type="button" className="sacramental-cancel-button" onClick={onCancel} disabled={saving}>Cancel</button>
    </div>
  </form>
}
