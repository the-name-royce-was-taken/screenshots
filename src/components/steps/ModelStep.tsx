import { useEffect, useState } from 'react';
import { useStore, SAMPLE_SHAPE_INFO } from '../../store/useStore';
import type { SampleShape } from '../../types/project';
import { useModelImport } from '../../hooks/useModelImport';
import { describeMeshCondition, formatDimensions, formatVolume, modelExtents } from '../../utils/model-summary';
import { PanelSection, StepPanel } from '../PanelChrome';
import { FolderOpenIcon, UploadIcon } from '../icons';
import { ConfirmButton } from '../ConfirmButton';
import type { WorkflowInputs } from '../workflow';

export function ModelStep({ inputs }: { inputs: WorkflowInputs }) {
  const store = useStore();
  const intake = useModelImport();
  const hasModel = Boolean(store.originalMesh || store.sphereMode);
  const extents = modelExtents(store.meshInfo, store.sampleShape, store.sphereRadius, store.params);
  const meshCondition = store.meshInfo ? describeMeshCondition(store.meshInfo) : null;
  const notice = store.importNotice;

  return (
    <StepPanel step="model" inputs={inputs}>
      {intake.fileInputs}
      <PanelSection>
        <div className="action-pair">
          <button
            type="button"
            className={`btn ${hasModel ? '' : 'btn-primary'}`}
            aria-describedby="model-import-hint"
            onClick={intake.pickModel}
          >
            <UploadIcon size={15} />
            Import model
          </button>
          <button
            type="button"
            className="btn"
            aria-describedby="model-import-hint"
            onClick={intake.pickProject}
          >
            <FolderOpenIcon size={15} />
            Open project
          </button>
        </div>
        <p className="field-hint" id="model-import-hint">
          STL, 3MF or OBJ (3MF units are converted to millimetres; STL and OBJ are read as
          millimetres), or a saved project (.json). You can also drop a file onto the page;
          it is read on this device, never uploaded.
        </p>

        {notice && (
          <div className={`import-notice level-${notice.level}`} role={notice.level === 'error' ? 'alert' : 'status'}>
            <div className="import-notice-body">
              <div>{notice.message}</div>
              {notice.detail && <div className="import-notice-detail">{notice.detail}</div>}
              {notice.scalePrompt && store.originalMesh && (
                <div className="import-notice-actions">
                  <button type="button" className="btn btn-tiny" onClick={() => store.setImportNotice(null)}>It is millimetres</button>
                  <button type="button" className="btn btn-tiny" onClick={() => intake.applyScale(25.4, 'from inches (×25.4)')}>Convert from inches</button>
                  <button type="button" className="btn btn-tiny" onClick={() => intake.applyScale(10, '×10')}>×10</button>
                  <button type="button" className="btn btn-tiny" onClick={() => intake.applyScale(0.1, '×0.1')}>×0.1</button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="import-notice-dismiss"
              aria-label="Dismiss import message"
              title="Dismiss"
              onClick={() => store.setImportNotice(null)}
            >
              ×
            </button>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Or start from a sample">
        <div className="sample-list" role="group" aria-label="Sample parts">
          {(Object.keys(SAMPLE_SHAPE_INFO) as SampleShape[]).map((shape) => (
            <button
              key={shape}
              type="button"
              className={`sample-chip${store.sampleShape === shape ? ' active' : ''}`}
              aria-pressed={store.sampleShape === shape}
              title={`Load the ${SAMPLE_SHAPE_INFO[shape].label} sample.`}
              onClick={() => intake.loadSample(shape)}
            >
              <SampleGlyph shape={shape} />
              <span>{SAMPLE_SHAPE_INFO[shape].label}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      {store.sampleShape && (
        <PanelSection title="Shape dimensions">
          <div className="shape-dimension-fields">
            {store.sampleShape === 'sphere' && <DimensionField label="Diameter" value={store.params.sampleSphereDiameter} onChange={(v) => store.updateParams({ sampleSphereDiameter: v })} />}
            {store.sampleShape === 'cube' && <>
              <DimensionField label="Width" value={store.params.sampleCubeWidth} onChange={(v) => store.updateParams({ sampleCubeWidth: v })} />
              <DimensionField label="Height" value={store.params.sampleCubeHeight} onChange={(v) => store.updateParams({ sampleCubeHeight: v })} />
            </>}
            {store.sampleShape === 'cylinder' && <>
              <DimensionField label="Diameter" value={store.params.sampleCylinderDiameter} onChange={(v) => store.updateParams({ sampleCylinderDiameter: v })} />
              <DimensionField label="Height" value={store.params.sampleCylinderHeight} onChange={(v) => store.updateParams({ sampleCylinderHeight: v })} />
            </>}
            {store.sampleShape === 'torus' && <>
              <DimensionField label="Inner diameter" value={store.params.sampleTorusInnerDiameter} onChange={(v) => store.updateParams(v < store.params.sampleTorusOuterDiameter ? { sampleTorusInnerDiameter: v } : { sampleTorusInnerDiameter: v, sampleTorusOuterDiameter: v + 0.1 })} />
              <DimensionField label="Outer diameter" value={store.params.sampleTorusOuterDiameter} onChange={(v) => store.updateParams(v > store.params.sampleTorusInnerDiameter ? { sampleTorusOuterDiameter: v } : { sampleTorusInnerDiameter: Math.max(0.1, v - 0.1), sampleTorusOuterDiameter: v })} />
            </>}
          </div>
          {store.sampleShape === 'torus' && store.params.sampleTorusOuterDiameter <= store.params.sampleTorusInnerDiameter && <p className="field-hint" role="alert">Outer diameter must be greater than inner diameter.</p>}
          <p className="field-hint">Enter dimensions in millimetres. Changes apply to the next generation.</p>
        </PanelSection>
      )}

      {hasModel && extents && (
        <PanelSection
          title="This part"
          aside={(
            <ConfirmButton
              action="Start over"
              className="text-button text-button-danger"
              title="Reset the project, parameters, and generated results."
              onConfirm={intake.startOver}
            />
          )}
        >
          <dl className="facts">
            <dt>{store.originalMesh ? 'File' : 'Model'}</dt><dd>{store.meshFileName}</dd>
            <dt>Size</dt><dd className="mono">{formatDimensions(extents.size)}</dd>
            <dt>Volume</dt><dd className="mono">{formatVolume(extents.volumeMm3)}</dd>
            {store.meshInfo ? (
              <>
                <dt>Triangles</dt><dd className="mono">{store.meshInfo.triangleCount.toLocaleString()}</dd>
                <dt>Vertices</dt><dd className="mono">{store.meshInfo.vertexCount.toLocaleString()}</dd>
                <dt>Watertight</dt><dd>{store.meshInfo.isWatertight ? 'Yes' : 'No'}</dd>
                <dt>Manifold</dt><dd>{store.meshInfo.isManifold ? 'Yes' : 'No'}</dd>
              </>
            ) : (
              <><dt>Mode</dt><dd>Procedural (analytic SDF)</dd></>
            )}
          </dl>
          {meshCondition?.level === 'warn' && store.meshInfo && (
            <div className="warning">
              {meshCondition.message}
              {store.meshInfo.boundaryEdges > 0 && (
                <div style={{ marginTop: '6px' }}>
                  <button type="button" className="btn btn-tiny" onClick={intake.closeHoles} title="Fill each open boundary loop with triangles.">
                    Close holes
                  </button>
                </div>
              )}
            </div>
          )}
        </PanelSection>
      )}
    </StepPanel>
  );
}

function DimensionField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="dimension-field">
      <span>{label} (mm)</span>
      <input
        type="number"
        min="0.1"
        max="1000"
        step="0.1"
        value={draft}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === '') return;
          const next = Number(raw);
          if (Number.isFinite(next) && next >= 0.1 && next <= 1000) onChange(next);
        }}
        onBlur={() => {
          const next = Number(draft);
          if (draft.trim() === '' || !Number.isFinite(next) || next < 0.1 || next > 1000) {
            setDraft(String(value));
          }
        }}
      />
    </label>
  );
}

/** A small outline of each sample, so the list reads at a glance. */
export function SampleGlyph({ shape }: { shape: SampleShape }) {
  return (
    <svg className="sample-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {shape === 'sphere' && (<><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="8.5" ry="3" /></>)}
      {shape === 'cube' && (<><path d="M12 3.5 19.5 7.5v9L12 20.5 4.5 16.5v-9z" /><path d="M4.5 7.5 12 11.5l7.5-4M12 11.5v9" /></>)}
      {shape === 'cylinder' && (<><ellipse cx="12" cy="6" rx="6.5" ry="2.5" /><path d="M5.5 6v12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6" /></>)}
      {shape === 'torus' && (<><ellipse cx="12" cy="12" rx="9" ry="5.5" /><ellipse cx="12" cy="11.5" rx="3.5" ry="1.6" /></>)}
      {shape === 'capsule' && (<><rect x="7" y="2.5" width="10" height="19" rx="5" /><path d="M7 9.5c1.5 1 8.5 1 10 0" /></>)}
    </svg>
  );
}
