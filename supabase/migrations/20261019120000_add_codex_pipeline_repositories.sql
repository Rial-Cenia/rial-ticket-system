alter table public."CodexRepositoryPolicy"
  add column if not exists provider text not null default 'GITHUB'
  check (provider in ('GITHUB', 'HUGGINGFACE_SPACE'));

insert into public."CodexRepositoryPolicy" (
  "fullName",
  provider,
  "baseBranch",
  "implementationEnabled",
  "allowedPaths",
  "forbiddenPaths",
  "maxChangedFiles"
)
values
  (
    'RIAL-AI/Playground',
    'HUGGINGFACE_SPACE',
    'main',
    true,
    array[
      'app.py',
      'interfaces/',
      'pipelines/',
      'tests/',
      'dashboard/',
      'run_templaterunner_parallel.py'
    ],
    array[
      '.env',
      '.env.*',
      'README.md',
      '.gitattributes',
      '.gitignore',
      'launcher/',
      'modal_apps/',
      'interfaces/static/',
      'rial-*.json',
      '*.xlsx'
    ],
    30
  ),
  (
    'Rial-Cenia/pipelines',
    'GITHUB',
    'main',
    true,
    array['*.py', 'core/', 'models/'],
    array[
      '.env',
      '.env.*',
      '.github/',
      '.gitignore',
      '.pre-commit-config.yaml',
      '*.xlsx'
    ],
    30
  ),
  (
    'Rial-Cenia/pipeline-tester',
    'GITHUB',
    'main',
    true,
    array['models/', 'main.py', 'pipeline_json_generator.py'],
    array[
      '.env',
      '.env.*',
      '.github/',
      '.gitmodules',
      '.pre-commit-config.yaml',
      'pipelines',
      'PipelineJsons/',
      'Dockerfile',
      'rial-*.json'
    ],
    30
  ),
  (
    'Rial-Cenia/modal-workers',
    'GITHUB',
    'main',
    true,
    array['*.py', 'README.md'],
    array[
      '.env',
      '.env.*',
      '.github/',
      '.claude/',
      '.firecrawl/',
      '*.pth',
      '*.png',
      '*.jpg'
    ],
    30
  )
on conflict ("fullName") do nothing;
