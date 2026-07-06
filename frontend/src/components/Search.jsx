import { useState, useEffect } from 'react'
import api from '../api'
import { useI18n } from '../i18n'
import EntryCard from './EntryCard'

export default function Search() {
  const { t } = useI18n()
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    api.get('/entries/tags/all').then((r) => setAllTags(r.data.tags || [])).catch(() => {})
  }, [])

  async function handleSearch() {
    setSearched(true)
    let url = '/search?'
    if (selectedTags.length > 0) url += `tags=${selectedTags.join(',')}&`
    if (fromDate) url += `from_date=${fromDate}&`
    if (toDate) url += `to_date=${toDate}&`
    try {
      const r = await api.get(url)
      setResults(r.data.entries || [])
    } catch {
      setResults([])
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t('search')}</h1>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t('filter_by_tags')}</label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedTags.includes(tag) ? 'bg-cyan-500 text-white' : 'card-bg border border-custom text-custom'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('date_range')} — from</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('date_range')} — to</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom" />
          </div>
        </div>

        <button onClick={handleSearch} className="w-full py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">{t('search')}</button>
      </div>

      {searched && (
        <>
          <p className="text-sm text-custom-muted mb-4">{t('found_entries', { count: results.length })}</p>
          {results.length === 0 ? (
            <p className="text-custom-muted">{t('no_results')}</p>
          ) : (
            <div className="space-y-3">
              {results.map((entry) => (
                <EntryCard key={entry.path} entry={entry} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
