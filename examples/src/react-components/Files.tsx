import { FileDropzone, File, Group, ActionHeader } from '@toolcase/react-components'

export const Files = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">File Manager</h1>
					<p className="text-muted mb-4">A file management layout combining FileDropzone, Group, File, and ActionHeader components.</p>
				</div>
			</div>

			<FileDropzone />
			<ActionHeader actions={[
				{ key: 'create_category', icon: 'plus', label: 'Create category' },
				{ key: 'upload', icon: 'cloud-upload', label: 'Upload' },
			]} />
			<Group label="Sprites" badge="3 items" onActionClick={() => console.log('Add sprite')}>
				<File name="hero.png" extension="png" format="image" size={1024} />
				<File name="enemy.png" extension="png" format="image" size={2048} />
				<File name="tileset.png" extension="png" format="image" size={8192} />
			</Group>
			<Group label="Audio" badge="2 items" onActionClick={() => console.log('Add audio')}>
				<File name="theme.ogg" extension="ogg" format="audio" size={51200} />
				<File name="jump.wav" extension="wav" format="audio" size={4096} />
			</Group>
			<Group label="Data" badge="2 items">
				<File name="levels.json" extension="json" size={512} />
				<File name="config.xml" extension="xml" size={256} />
			</Group>
		</div>
	)
}
